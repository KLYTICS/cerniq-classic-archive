//! AI Market Insights Routes
//! Market sentiment, trending topics, sector heat maps, and AI-generated summaries

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::error::{AppError, Result};
use crate::state::AppState;
use crate::services::mock_valuations::{get_mock_valuation, get_all_mock_valuations};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/sentiment", get(get_market_sentiment))
        .route("/trending", get(get_trending))
        .route("/sectors", get(get_sector_heatmap))
        .route("/summary/:ticker", get(get_ticker_summary))
        .route("/news", get(get_news_feed))
}

// ===== Response Types =====

#[derive(Serialize)]
pub struct MarketSentiment {
    overall_score: f64,           // -100 to 100
    sentiment_label: String,      // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
    fear_greed_index: i32,        // 0-100
    components: SentimentComponents,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct SentimentComponents {
    market_momentum: f64,
    market_volatility: f64,
    put_call_ratio: f64,
    safe_haven_demand: f64,
    stock_breadth: f64,
}

#[derive(Serialize)]
pub struct TrendingTicker {
    ticker: String,
    name: String,
    sector: String,
    price: f64,
    change_pct: f64,
    volume_spike: f64,   // multiplier vs average
    mentions: i32,       // social/news mentions
    sentiment: String,   // "bullish", "bearish", "neutral"
}

#[derive(Serialize)]
pub struct SectorHeatMap {
    sectors: Vec<SectorData>,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct SectorData {
    name: String,
    performance_1d: f64,
    performance_1w: f64,
    performance_1m: f64,
    performance_ytd: f64,
    top_gainer: String,
    top_loser: String,
    average_pe: f64,
    sentiment: String,
}

#[derive(Serialize)]
pub struct TickerSummary {
    ticker: String,
    name: String,
    summary: String,
    key_points: Vec<String>,
    sentiment: String,
    sentiment_score: f64,
    price_target: f64,
    analyst_rating: String,
    recent_news: Vec<NewsItem>,
}

#[derive(Serialize)]
pub struct NewsItem {
    title: String,
    source: String,
    sentiment: String,
    published_at: DateTime<Utc>,
    url: String,
}

// ===== Endpoints =====

/// GET /api/insights/sentiment - Overall market sentiment
pub async fn get_market_sentiment() -> impl IntoResponse {
    // Generate realistic market sentiment based on a mix of factors
    let momentum = 65.0;      // Market is slightly bullish
    let volatility = -15.0;   // Low volatility = positive
    let put_call = 12.0;      // Put/call ratio neutral
    let safe_haven = -8.0;    // Low safe haven demand = risk-on
    let breadth = 58.0;       // More stocks advancing than declining
    
    let overall = (momentum + volatility + put_call + safe_haven + breadth) / 5.0;
    let fear_greed = ((overall + 100.0) / 2.0) as i32;
    
    let label = match fear_greed {
        0..=20 => "Extreme Fear",
        21..=40 => "Fear", 
        41..=60 => "Neutral",
        61..=80 => "Greed",
        _ => "Extreme Greed",
    };
    
    Json(MarketSentiment {
        overall_score: overall,
        sentiment_label: label.to_string(),
        fear_greed_index: fear_greed,
        components: SentimentComponents {
            market_momentum: momentum,
            market_volatility: volatility,
            put_call_ratio: put_call,
            safe_haven_demand: safe_haven,
            stock_breadth: breadth,
        },
        updated_at: Utc::now(),
    })
}

/// GET /api/insights/trending - Trending tickers
pub async fn get_trending() -> impl IntoResponse {
    let trending = vec![
        TrendingTicker {
            ticker: "NVDA".to_string(),
            name: "NVIDIA Corporation".to_string(),
            sector: "Semiconductors".to_string(),
            price: 878.35,
            change_pct: 3.2,
            volume_spike: 2.4,
            mentions: 4523,
            sentiment: "bullish".to_string(),
        },
        TrendingTicker {
            ticker: "META".to_string(),
            name: "Meta Platforms".to_string(),
            sector: "Technology".to_string(),
            price: 605.75,
            change_pct: 2.1,
            volume_spike: 1.8,
            mentions: 2891,
            sentiment: "bullish".to_string(),
        },
        TrendingTicker {
            ticker: "TSLA".to_string(),
            name: "Tesla Inc".to_string(),
            sector: "Automotive".to_string(),
            price: 368.20,
            change_pct: -1.5,
            volume_spike: 3.2,
            mentions: 5124,
            sentiment: "mixed".to_string(),
        },
        TrendingTicker {
            ticker: "AMD".to_string(),
            name: "Advanced Micro Devices".to_string(),
            sector: "Semiconductors".to_string(),
            price: 118.45,
            change_pct: 4.5,
            volume_spike: 2.1,
            mentions: 1823,
            sentiment: "bullish".to_string(),
        },
        TrendingTicker {
            ticker: "COIN".to_string(),
            name: "Coinbase Global".to_string(),
            sector: "Financial Services".to_string(),
            price: 285.40,
            change_pct: 8.2,
            volume_spike: 4.5,
            mentions: 3421,
            sentiment: "bullish".to_string(),
        },
        TrendingTicker {
            ticker: "ASML".to_string(),
            name: "ASML Holding".to_string(),
            sector: "Semiconductors".to_string(),
            price: 728.45,
            change_pct: 2.8,
            volume_spike: 1.5,
            mentions: 892,
            sentiment: "bullish".to_string(),
        },
        TrendingTicker {
            ticker: "BA".to_string(),
            name: "Boeing Company".to_string(),
            sector: "Industrials".to_string(),
            price: 178.45,
            change_pct: -2.8,
            volume_spike: 2.8,
            mentions: 1245,
            sentiment: "bearish".to_string(),
        },
        TrendingTicker {
            ticker: "NKE".to_string(),
            name: "Nike Inc".to_string(),
            sector: "Consumer Cyclical".to_string(),
            price: 78.45,
            change_pct: -1.2,
            volume_spike: 1.9,
            mentions: 756,
            sentiment: "bearish".to_string(),
        },
    ];
    
    Json(trending)
}

/// GET /api/insights/sectors - Sector heat map
pub async fn get_sector_heatmap() -> impl IntoResponse {
    let sectors = vec![
        SectorData {
            name: "Technology".to_string(),
            performance_1d: 1.2,
            performance_1w: 3.5,
            performance_1m: 8.2,
            performance_ytd: 15.4,
            top_gainer: "META +2.1%".to_string(),
            top_loser: "CRM -0.8%".to_string(),
            average_pe: 32.5,
            sentiment: "bullish".to_string(),
        },
        SectorData {
            name: "Semiconductors".to_string(),
            performance_1d: 2.5,
            performance_1w: 5.8,
            performance_1m: 12.4,
            performance_ytd: 28.5,
            top_gainer: "AMD +4.5%".to_string(),
            top_loser: "INTC -1.2%".to_string(),
            average_pe: 35.8,
            sentiment: "very bullish".to_string(),
        },
        SectorData {
            name: "Financial Services".to_string(),
            performance_1d: 0.8,
            performance_1w: 2.1,
            performance_1m: 4.5,
            performance_ytd: 8.2,
            top_gainer: "GS +1.5%".to_string(),
            top_loser: "WFC -0.5%".to_string(),
            average_pe: 14.2,
            sentiment: "neutral".to_string(),
        },
        SectorData {
            name: "Healthcare".to_string(),
            performance_1d: -0.3,
            performance_1w: 0.5,
            performance_1m: 2.1,
            performance_ytd: 4.8,
            top_gainer: "UNH +1.2%".to_string(),
            top_loser: "PFE -2.1%".to_string(),
            average_pe: 18.5,
            sentiment: "neutral".to_string(),
        },
        SectorData {
            name: "Energy".to_string(),
            performance_1d: 0.5,
            performance_1w: -1.2,
            performance_1m: 2.8,
            performance_ytd: 5.4,
            top_gainer: "XOM +0.8%".to_string(),
            top_loser: "SLB -1.5%".to_string(),
            average_pe: 12.8,
            sentiment: "neutral".to_string(),
        },
        SectorData {
            name: "Consumer Cyclical".to_string(),
            performance_1d: -0.2,
            performance_1w: 1.8,
            performance_1m: 3.5,
            performance_ytd: 7.2,
            top_gainer: "AMZN +1.2%".to_string(),
            top_loser: "NKE -1.2%".to_string(),
            average_pe: 28.4,
            sentiment: "neutral".to_string(),
        },
        SectorData {
            name: "Industrials".to_string(),
            performance_1d: 0.3,
            performance_1w: 1.5,
            performance_1m: 3.8,
            performance_ytd: 6.5,
            top_gainer: "CAT +1.2%".to_string(),
            top_loser: "BA -2.8%".to_string(),
            average_pe: 22.5,
            sentiment: "neutral".to_string(),
        },
        SectorData {
            name: "Communication Services".to_string(),
            performance_1d: 0.8,
            performance_1w: 2.5,
            performance_1m: 5.2,
            performance_ytd: 12.8,
            top_gainer: "NFLX +2.5%".to_string(),
            top_loser: "T -0.5%".to_string(),
            average_pe: 24.8,
            sentiment: "bullish".to_string(),
        },
    ];
    
    Json(SectorHeatMap {
        sectors,
        updated_at: Utc::now(),
    })
}

/// GET /api/insights/summary/:ticker - AI-generated ticker summary
pub async fn get_ticker_summary(
    Path(ticker): Path<String>,
) -> Result<Json<TickerSummary>> {
    let ticker_upper = ticker.to_uppercase();
    
    let mock = get_mock_valuation(&ticker_upper)
        .ok_or_else(|| AppError::NotFound(format!("No data for {}", ticker_upper)))?;
    
    // Generate summary based on valuation data
    let summary = format!(
        "{} ({}) is currently trading at ${:.2}, representing a potential {}% {} based on our fair value estimate of ${:.2}. \
        The stock trades at {:.1}x trailing earnings and {:.1}x forward earnings, \
        with {}% revenue growth. The company is in the {} phase of its business cycle.",
        mock.name, mock.ticker, mock.current_price,
        mock.upside_pct.abs(), 
        if mock.upside_pct > 0.0 { "upside" } else { "downside" },
        mock.fair_value,
        mock.pe_ratio, mock.forward_pe,
        mock.revenue_growth,
        mock.cycle_position
    );
    
    let key_points = vec![
        format!("Current P/E: {:.1}x vs forward P/E: {:.1}x", mock.pe_ratio, mock.forward_pe),
        format!("Fair value estimate: ${:.2} ({:+.1}% from current)", mock.fair_value, mock.upside_pct),
        format!("Sector: {} - Cycle position: {}", mock.sector, mock.cycle_position),
        format!("Growth: Revenue {:.1}%, Earnings {:.1}%", mock.revenue_growth, mock.earnings_growth),
        format!("Analyst rating: {}", mock.rating),
    ];
    
    let sentiment = if mock.upside_pct > 15.0 { "bullish" }
        else if mock.upside_pct > 0.0 { "slightly bullish" }
        else if mock.upside_pct > -15.0 { "slightly bearish" }
        else { "bearish" };
    
    let news = vec![
        NewsItem {
            title: format!("{} reports strong quarterly results, beats expectations", mock.name),
            source: "Reuters".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: format!("https://reuters.com/{}", mock.ticker.to_lowercase()),
        },
        NewsItem {
            title: format!("Analyst upgrades {} to {}", mock.ticker, mock.rating),
            source: "Bloomberg".to_string(),
            sentiment: if mock.upside_pct > 0.0 { "positive" } else { "neutral" }.to_string(),
            published_at: Utc::now(),
            url: format!("https://bloomberg.com/{}", mock.ticker.to_lowercase()),
        },
        NewsItem {
            title: format!("{} announces new product launch in {} sector", mock.name, mock.sector),
            source: "CNBC".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: format!("https://cnbc.com/{}", mock.ticker.to_lowercase()),
        },
    ];
    
    Ok(Json(TickerSummary {
        ticker: mock.ticker,
        name: mock.name,
        summary,
        key_points,
        sentiment: sentiment.to_string(),
        sentiment_score: mock.upside_pct / 2.0 + 50.0, // Scale to 0-100
        price_target: mock.fair_value,
        analyst_rating: mock.rating,
        recent_news: news,
    }))
}

/// GET /api/insights/news - Aggregated news feed
pub async fn get_news_feed() -> impl IntoResponse {
    let news = vec![
        NewsItem {
            title: "NVIDIA announces next-gen AI chips, stock surges".to_string(),
            source: "Reuters".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: "https://reuters.com/nvda".to_string(),
        },
        NewsItem {
            title: "Fed signals potential rate cuts in coming months".to_string(),
            source: "Bloomberg".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: "https://bloomberg.com/fed".to_string(),
        },
        NewsItem {
            title: "Tech sector leads market rally as earnings beat expectations".to_string(),
            source: "CNBC".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: "https://cnbc.com/tech".to_string(),
        },
        NewsItem {
            title: "Tesla faces increased competition in EV market".to_string(),
            source: "WSJ".to_string(),
            sentiment: "negative".to_string(),
            published_at: Utc::now(),
            url: "https://wsj.com/tsla".to_string(),
        },
        NewsItem {
            title: "Semiconductor stocks rally on AI demand outlook".to_string(),
            source: "MarketWatch".to_string(),
            sentiment: "positive".to_string(),
            published_at: Utc::now(),
            url: "https://marketwatch.com/semi".to_string(),
        },
        NewsItem {
            title: "Oil prices stabilize as OPEC maintains production targets".to_string(),
            source: "Reuters".to_string(),
            sentiment: "neutral".to_string(),
            published_at: Utc::now(),
            url: "https://reuters.com/oil".to_string(),
        },
    ];
    
    Json(news)
}
