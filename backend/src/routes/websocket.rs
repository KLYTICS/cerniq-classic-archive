use axum::extract::{ws::{Message, WebSocket, WebSocketUpgrade}, State};
use axum::response::Response;
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{info, warn};

use crate::services::market_data::MarketDataService;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe { tickers: Vec<String> },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { tickers: Vec<String> },
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
enum ServerMessage {
    #[serde(rename = "price_update")]
    PriceUpdate {
        ticker: String,
        price: f64,
        change: f64,
        change_percent: f64,
        volume: i64,
        timestamp: String,
    },
    #[serde(rename = "subscribed")]
    Subscribed { tickers: Vec<String> },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "pong")]
    Pong,
}

pub async fn handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    
    let mut subscribed_tickers: Vec<String> = Vec::new();
    let mut update_interval = interval(Duration::from_secs(5)); // Update every 5 seconds

    info!("WebSocket connection established");

    loop {
        tokio::select! {
            // Handle incoming messages from client
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(ClientMessage::Subscribe { tickers }) => {
                                info!("Client subscribing to: {:?}", tickers);
                                subscribed_tickers.extend(tickers.clone());
                                subscribed_tickers.sort();
                                subscribed_tickers.dedup();
                                
                                let response = ServerMessage::Subscribed {
                                    tickers: subscribed_tickers.clone(),
                                };
                                
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let _ = sender.send(Message::Text(json)).await;
                                }
                            }
                            Ok(ClientMessage::Unsubscribe { tickers }) => {
                                subscribed_tickers.retain(|t| !tickers.contains(t));
                            }
                            Ok(ClientMessage::Ping) => {
                                let pong = ServerMessage::Pong;
                                if let Ok(json) = serde_json::to_string(&pong) {
                                    let _ = sender.send(Message::Text(json)).await;
                                }
                            }
                            Err(e) => {
                                warn!("Failed to parse client message: {}", e);
                                let error = ServerMessage::Error {
                                    message: "Invalid message format".to_string(),
                                };
                                if let Ok(json) = serde_json::to_string(&error) {
                                    let _ = sender.send(Message::Text(json)).await;
                                }
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("Client closed WebSocket connection");
                        break;
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error: {}", e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }
            
            // Send periodic price updates
            _ = update_interval.tick() => {
                if !subscribed_tickers.is_empty() {
                    // Fetch latest prices for subscribed tickers
                    let market_service = MarketDataService::new(
                        state.db.clone(),
                        state.redis.clone(),
                        state.config.alphavantage_api_key.clone(),
                    );
                    
                    let end_date = chrono::Utc::now().naive_utc().date();
                    let start_date = end_date - chrono::Duration::days(2); // Last 2 days
                    
                    for ticker in &subscribed_tickers {
                        match market_service.get_prices(ticker, start_date, end_date).await {
                            Ok(prices) if !prices.is_empty() => {
                                // Get the two most recent prices to calculate change
                                let latest = &prices[prices.len() - 1];
                                let previous = if prices.len() > 1 {
                                    &prices[prices.len() - 2]
                                } else {
                                    latest
                                };
                                
                                let change = latest.close - previous.close;
                                let change_percent = if previous.close != 0.0 {
                                    (change / previous.close) * 100.0
                                } else {
                                    0.0
                                };
                                
                                let update = ServerMessage::PriceUpdate {
                                    ticker: ticker.clone(),
                                    price: latest.close,
                                    change,
                                    change_percent,
                                    volume: latest.volume,
                                    timestamp: chrono::Utc::now().to_rfc3339(),
                                };
                                
                                if let Ok(json) = serde_json::to_string(&update) {
                                    if sender.send(Message::Text(json)).await.is_err() {
                                        warn!("Failed to send update for {}", ticker);
                                        break;
                                    }
                                }
                            }
                            Ok(_) => {
                                warn!("No data available for {}", ticker);
                            }
                            Err(e) => {
                                warn!("Failed to fetch data for {}: {}", ticker, e);
                                let error = ServerMessage::Error {
                                    message: format!("Failed to fetch {}: {}", ticker, e),
                                };
                                if let Ok(json) = serde_json::to_string(&error) {
                                    let _ = sender.send(Message::Text(json)).await;
                                }
                            }
                        }
                        
                        // Small delay between tickers to avoid overwhelming the client
                        tokio::time::sleep(Duration::from_millis(100)).await;
                    }
                }
            }
        }
    }

    info!("WebSocket connection closed");
}
