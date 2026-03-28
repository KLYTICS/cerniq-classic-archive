"""
Risk Parity Portfolio - AI Infrastructure Stack
Streamlit App
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import yfinance as yf
from datetime import datetime, timedelta
from risk_parity import (
    RiskParityOptimizer,
    compute_portfolio_metrics,
    equal_weight_portfolio
)

# Page config
st.set_page_config(
    page_title="Risk Parity - AI Infra",
    page_icon="⚖️",
    layout="wide"
)

# Title
st.title("⚖️ Risk Parity Portfolio: AI Infrastructure Stack")
st.markdown("""
Build a risk-balanced portfolio across the AI capital expenditure supply chain.
**Goal:** Equal risk contribution from each asset, not equal weights.
""")

# Sidebar configuration
st.sidebar.header("Configuration")

# AI Stack layers with tickers
LAYERS = {
    "Semiconductors (GPUs/Compute)": ["NVDA", "AMD", "AVGO"],
    "Equipment (Fab Tools)": ["LRCX", "AMAT", "ASML"],
    "Cloud Infrastructure": ["MSFT", "GOOGL", "AMZN", "META"],
    "Networking": ["ANET", "CSCO"],
    "Power/Utilities": ["AEP", "NEE"]
}

# Flatten to get all tickers
ALL_TICKERS = []
for layer_tickers in LAYERS.values():
    ALL_TICKERS.extend(layer_tickers)

# User selections
selected_layers = st.sidebar.multiselect(
    "Select Layers to Include",
    options=list(LAYERS.keys()),
    default=list(LAYERS.keys())
)

# Build ticker list from selected layers
selected_tickers = []
for layer in selected_layers:
    selected_tickers.extend(LAYERS[layer])

# Date range
end_date = datetime.now()
start_date = st.sidebar.date_input(
    "Start Date",
    value=end_date - timedelta(days=3*365),  # 3 years default
    max_value=end_date
)

# Optimization settings
lookback_days = st.sidebar.slider(
    "Covariance Lookback (days)",
    min_value=60,
    max_value=504,
    value=252,
    step=21
)

rebalance_freq = st.sidebar.selectbox(
    "Rebalance Frequency",
    options=["Monthly", "Quarterly", "Annual"],
    index=0
)

# Download data
@st.cache_data
def load_data(tickers, start, end):
    """Download price data from yfinance."""
    data = yf.download(
        tickers,
        start=start,
        end=end,
        progress=False
    )['Adj Close']
    
    if isinstance(data, pd.Series):
        data = data.to_frame()
        data.columns = [tickers[0]]
    
    return data

@st.cache_data
def compute_returns(prices):
    """Compute daily returns."""
    return prices.pct_change().dropna()

# Main content
if len(selected_tickers) < 2:
    st.warning("⚠️ Please select at least 2 layers to build a portfolio.")
else:
    with st.spinner("Loading market data..."):
        try:
            prices = load_data(selected_tickers, start_date, end_date)
            returns = compute_returns(prices)
            
            # Check for missing data
            if returns.isnull().any().any():
                st.warning(f"⚠️ Some tickers have missing data. Dropping: {returns.columns[returns.isnull().any()].tolist()}")
                returns = returns.dropna(axis=1)
                selected_tickers = returns.columns.tolist()
            
            st.success(f"✓ Loaded {len(selected_tickers)} assets from {start_date} to {end_date.date()}")
            
            # Display selected portfolio
            st.subheader("📊 Selected Portfolio")
            col1, col2 = st.columns([1, 2])
            
            with col1:
                st.markdown("**Assets by Layer:**")
                for layer in selected_layers:
                    layer_tickers = [t for t in LAYERS[layer] if t in selected_tickers]
                    if layer_tickers:
                        st.markdown(f"**{layer}:**")
                        for ticker in layer_tickers:
                            st.markdown(f"- {ticker}")
            
            with col2:
                # Price chart
                normalized_prices = prices / prices.iloc[0] * 100
                fig = px.line(
                    normalized_prices,
                    title="Normalized Price Performance (Base = 100)",
                    labels={"value": "Price Index", "variable": "Ticker"}
                )
                fig.update_layout(height=350, showlegend=True, legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=-0.3
                ))
                st.plotly_chart(fig, use_container_width=True)
            
            # Optimize risk parity portfolio
            st.subheader("⚙️ Risk Parity Optimization")
            
            # Use recent data for optimization
            recent_returns = returns.tail(lookback_days)
            
            with st.spinner("Computing optimal weights..."):
                optimizer = RiskParityOptimizer(method='cvxpy')
                optimizer.fit(recent_returns)
                
                rp_weights = optimizer.get_weights()
                risk_contrib = optimizer.get_risk_contributions()
                
                # Benchmarks
                ew_weights = equal_weight_portfolio(selected_tickers)
            
            # Display weights
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.markdown("**Risk Parity Weights**")
                weights_df = pd.DataFrame({
                    'Ticker': rp_weights.index,
                    'Weight (%)': (rp_weights * 100).round(2)
                }).sort_values('Weight (%)', ascending=False)
                st.dataframe(weights_df, hide_index=True, height=400)
            
            with col2:
                st.markdown("**Equal Weight (Benchmark)**")
                ew_df = pd.DataFrame({
                    'Ticker': ew_weights.index,
                    'Weight (%)': (ew_weights * 100).round(2)
                })
                st.dataframe(ew_df, hide_index=True, height=400)
            
            with col3:
                st.markdown("**Risk Contribution**")
                risk_df = pd.DataFrame({
                    'Ticker': risk_contrib.index,
                    'Risk (%)': (risk_contrib * 100).round(2)
                }).sort_values('Risk (%)', ascending=False)
                st.dataframe(risk_df, hide_index=True, height=400)
            
            # Risk contribution pie chart
            st.subheader("📈 Risk Contribution Breakdown")
            fig = go.Figure(data=[go.Pie(
                labels=risk_contrib.index,
                values=risk_contrib.values * 100,
                hole=0.3,
                textinfo='label+percent',
                textposition='auto'
            )])
            fig.update_layout(
                title="Risk Parity: Each Asset Contributes Equally to Risk",
                showlegend=False,
                height=400
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Backtest comparison
            st.subheader("📊 Backtest Performance")
            
            # Compute portfolio metrics
            rp_metrics = compute_portfolio_metrics(returns, rp_weights)
            ew_metrics = compute_portfolio_metrics(returns, ew_weights)
            
            # Cumulative returns
            rp_cumulative = (1 + rp_metrics['portfolio_returns']).cumprod()
            ew_cumulative = (1 + ew_metrics['portfolio_returns']).cumprod()
            
            # Plot
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=rp_cumulative.index,
                y=rp_cumulative.values,
                mode='lines',
                name='Risk Parity',
                line=dict(color='blue', width=2)
            ))
            fig.add_trace(go.Scatter(
                x=ew_cumulative.index,
                y=ew_cumulative.values,
                mode='lines',
                name='Equal Weight',
                line=dict(color='gray', width=2, dash='dash')
            ))
            fig.update_layout(
                title="Cumulative Returns: Risk Parity vs Equal Weight",
                xaxis_title="Date",
                yaxis_title="Cumulative Return (Base = 1)",
                hovermode='x unified',
                height=400
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Metrics comparison table
            st.subheader("📊 Performance Metrics")
            
            metrics_comparison = pd.DataFrame({
                'Metric': [
                    'Total Return',
                    'CAGR',
                    'Volatility (Annual)',
                    'Sharpe Ratio',
                    'Max Drawdown'
                ],
                'Risk Parity': [
                    f"{rp_metrics['total_return']*100:.2f}%",
                    f"{rp_metrics['cagr']*100:.2f}%",
                    f"{rp_metrics['volatility']*100:.2f}%",
                    f"{rp_metrics['sharpe_ratio']:.2f}",
                    f"{rp_metrics['max_drawdown']*100:.2f}%"
                ],
                'Equal Weight': [
                    f"{ew_metrics['total_return']*100:.2f}%",
                    f"{ew_metrics['cagr']*100:.2f}%",
                    f"{ew_metrics['volatility']*100:.2f}%",
                    f"{ew_metrics['sharpe_ratio']:.2f}",
                    f"{ew_metrics['max_drawdown']*100:.2f}%"
                ]
            })
            
            st.dataframe(metrics_comparison, hide_index=True, use_container_width=True)
            
            # Correlation heatmap
            st.subheader("🔥 Correlation Matrix")
            corr = recent_returns.corr()
            
            fig = go.Figure(data=go.Heatmap(
                z=corr.values,
                x=corr.columns,
                y=corr.index,
                colorscale='RdBu',
                zmid=0,
                text=corr.values.round(2),
                texttemplate='%{text}',
                textfont={"size": 10}
            ))
            fig.update_layout(
                title=f"Asset Correlations ({lookback_days}-day window)",
                height=500
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Download weights
            st.subheader("💾 Export")
            csv = weights_df.to_csv(index=False)
            st.download_button(
                label="Download Risk Parity Weights (CSV)",
                data=csv,
                file_name=f"risk_parity_weights_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )
            
        except Exception as e:
            st.error(f"❌ Error loading data: {str(e)}")
            st.info("Try selecting different tickers or adjusting the date range.")

# Footer
st.markdown("---")
st.markdown("""
**Methodology:** Risk parity allocates capital such that each asset contributes equally to total portfolio risk,
rather than equal dollar amounts. This typically results in higher allocation to lower-volatility assets.

**Data Source:** Yahoo Finance via yfinance  
**Optimization:** CVXPY (convex optimization)  
**Built with:** Streamlit, Plotly, pandas
""")
