"""
VaR/CVaR Risk Report Generator
Streamlit App
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import yfinance as yf
from datetime import datetime, timedelta
from risk_engine import RiskEngine

# Page config
st.set_page_config(
    page_title="VaR Risk Reports",
    page_icon="⚠️",
    layout="wide"
)

# Title
st.title("⚠️ Portfolio Risk Report Generator")
st.markdown("""
Institutional-grade Value at Risk (VaR) and Conditional VaR (CVaR) analysis.
Upload a portfolio and get comprehensive risk metrics and visualizations.
""")

# Sidebar
st.sidebar.header("Portfolio Configuration")

# Input method
input_method = st.sidebar.radio(
    "Input Method",
    options=["Manual Entry", "Upload CSV"]
)

portfolio = {}

if input_method == "Manual Entry":
    # Example AI infrastructure portfolio
    st.sidebar.markdown("**Example: AI Infrastructure Portfolio**")
    
    default_tickers = ["NVDA", "MSFT", "ANET", "AMD", "GOOGL"]
    default_weights = [0.25, 0.20, 0.20, 0.20, 0.15]
    
    tickers_input = st.sidebar.text_input(
        "Tickers (comma-separated)",
        value=",".join(default_tickers)
    )
    
    weights_input = st.sidebar.text_input(
        "Weights (comma-separated, must sum to 1)",
        value=",".join(map(str, default_weights))
    )
    
    if tickers_input and weights_input:
        tickers = [t.strip().upper() for t in tickers_input.split(",")]
        try:
            weights = [float(w.strip()) for w in weights_input.split(",")]
            
            if len(tickers) != len(weights):
                st.sidebar.error("❌ Number of tickers must match number of weights")
            elif not np.isclose(sum(weights), 1.0, atol=0.01):
                st.sidebar.error(f"❌ Weights must sum to 1.0 (currently {sum(weights):.3f})")
            else:
                portfolio = dict(zip(tickers, weights))
                st.sidebar.success(f"✓ Portfolio with {len(portfolio)} assets")
        except ValueError:
            st.sidebar.error("❌ Invalid weight format. Use numbers only.")
else:
    uploaded_file = st.sidebar.file_uploader(
        "Upload CSV (columns: ticker, weight)",
        type="csv"
    )
    if uploaded_file:
        df = pd.read_csv(uploaded_file)
        if 'ticker' in df.columns and 'weight' in df.columns:
            portfolio = dict(zip(df['ticker'].str.upper(), df['weight']))
            st.sidebar.success(f"✓ Loaded {len(portfolio)} assets")
        else:
            st.sidebar.error("❌ CSV must have 'ticker' and 'weight' columns")

# Date range
end_date = datetime.now()
start_date = st.sidebar.date_input(
    "Start Date",
    value=end_date - timedelta(days=365),
    max_value=end_date
)

# Risk parameters
confidence_levels = st.sidebar.multiselect(
    "Confidence Levels",
    options=[0.90, 0.95, 0.99],
    default=[0.95, 0.99]
)

risk_free_rate = st.sidebar.number_input(
    "Risk-Free Rate (annual %)",
    value=4.5,
    min_value=0.0,
    max_value=20.0,
    step=0.1
) / 100

# Main content
if not portfolio:
    st.info("👈 Configure your portfolio in the sidebar to generate a risk report.")
else:
    # Download data
    @st.cache_data
    def load_data(tickers: tuple, start, end):
        """Load price data from Yahoo Finance."""
        ticker_list = list(tickers)
        try:
            data = yf.download(
                ticker_list,
                start=start,
                end=end,
                progress=False
            )

            if data.empty:
                return pd.DataFrame()

            # Handle multi-level columns from yfinance
            if isinstance(data.columns, pd.MultiIndex):
                data = data['Adj Close']
            elif 'Adj Close' in data.columns:
                data = data[['Adj Close']]
                data.columns = ticker_list

            # Handle single ticker case
            if isinstance(data, pd.Series):
                data = data.to_frame()
                data.columns = [ticker_list[0]]

            return data
        except Exception as e:
            st.warning(f"Data fetch warning: {e}")
            return pd.DataFrame()

    with st.spinner("Loading market data..."):
        try:
            prices = load_data(tuple(portfolio.keys()), start_date, end_date)

            if prices.empty:
                st.error("❌ Could not load price data. Please check your internet connection and ticker symbols.")
                st.stop()

            returns = prices.pct_change().dropna()

            if returns.empty or len(returns) < 10:
                st.error("❌ Insufficient data. Please try a longer date range.")
                st.stop()

            # Check for missing data
            missing = [t for t in portfolio.keys() if t not in returns.columns]
            if missing:
                st.error(f"❌ Could not load data for: {', '.join(missing)}")
                st.stop()
            
            # Create weight series
            weights = pd.Series(portfolio)
            
            # Initialize risk engine
            engine = RiskEngine(returns, weights, confidence_levels)
            
            # Generate report
            report = engine.generate_risk_report()
            
            # Display report
            st.success(f"✓ Risk report generated for {report['summary']['n_days']} trading days")
            
            # Summary metrics
            st.header("📊 Risk Summary")
            
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.metric(
                    "Annual Volatility",
                    f"{report['volatility']['annual']*100:.2f}%"
                )
            
            with col2:
                st.metric(
                    "Max Drawdown",
                    f"{report['drawdown']['max_drawdown']*100:.2f}%"
                )
            
            with col3:
                st.metric(
                    "Sharpe Ratio",
                    f"{report['performance']['sharpe_ratio']:.2f}"
                )
            
            with col4:
                st.metric(
                    "Total Return",
                    f"{report['performance']['total_return']*100:.2f}%"
                )
            
            # VaR/CVaR table
            st.subheader("⚠️ Value at Risk (VaR) & Conditional VaR (CVaR)")
            
            var_data = []
            for conf_pct, metrics in report['var_cvar'].items():
                var_data.append({
                    'Confidence Level': conf_pct,
                    'VaR (Historical)': f"{metrics['var_historical']*100:.2f}%",
                    'CVaR (Historical)': f"{metrics['cvar_historical']*100:.2f}%",
                    'VaR (Parametric)': f"{metrics['var_parametric']*100:.2f}%"
                })
            
            var_df = pd.DataFrame(var_data)
            st.dataframe(var_df, hide_index=True, use_container_width=True)
            
            st.markdown("""
            **Interpretation:**
            - **VaR(95%)**: "We are 95% confident that daily losses won't exceed this amount"
            - **CVaR(95%)**: "If we exceed VaR, the average loss will be this amount"
            - **Historical**: Based on actual historical returns
            - **Parametric**: Assumes normal distribution
            """)
            
            # Portfolio composition
            st.subheader("💼 Portfolio Composition")
            
            col1, col2 = st.columns([1, 2])
            
            with col1:
                weights_df = pd.DataFrame({
                    'Ticker': weights.index,
                    'Weight (%)': (weights * 100).values
                }).sort_values('Weight (%)', ascending=False)
                st.dataframe(weights_df, hide_index=True, height=300)
            
            with col2:
                fig = go.Figure(data=[go.Pie(
                    labels=weights.index,
                    values=weights.values * 100,
                    hole=0.3,
                    textinfo='label+percent'
                )])
                fig.update_layout(
                    title="Portfolio Allocation",
                    showlegend=False,
                    height=300
                )
                st.plotly_chart(fig, use_container_width=True)
            
            # Cumulative returns and drawdown
            st.subheader("📈 Performance & Drawdown")
            
            cumulative = (1 + engine.portfolio_returns).cumprod()
            drawdown = engine.compute_max_drawdown()['drawdown_series']
            
            fig = go.Figure()
            
            # Add cumulative return trace
            fig.add_trace(go.Scatter(
                x=cumulative.index,
                y=(cumulative - 1) * 100,
                name='Cumulative Return',
                yaxis='y',
                line=dict(color='blue', width=2)
            ))
            
            # Add drawdown trace on secondary axis
            fig.add_trace(go.Scatter(
                x=drawdown.index,
                y=drawdown * 100,
                name='Drawdown',
                yaxis='y2',
                fill='tozeroy',
                line=dict(color='red', width=1),
                fillcolor='rgba(255,0,0,0.2)'
            ))
            
            fig.update_layout(
                title="Cumulative Returns vs Drawdown",
                xaxis_title="Date",
                yaxis=dict(
                    title="Cumulative Return (%)",
                    side="left"
                ),
                yaxis2=dict(
                    title="Drawdown (%)",
                    side="right",
                    overlaying="y"
                ),
                hovermode='x unified',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Rolling volatility
            st.subheader("📊 Rolling Volatility")
            
            rolling_vol = engine.get_rolling_volatility([30, 60, 90])
            
            fig = go.Figure()
            for col in rolling_vol.columns:
                fig.add_trace(go.Scatter(
                    x=rolling_vol.index,
                    y=rolling_vol[col] * 100,
                    name=col,
                    mode='lines'
                ))
            
            fig.update_layout(
                title="Rolling Volatility (Annualized)",
                xaxis_title="Date",
                yaxis_title="Volatility (%)",
                hovermode='x unified',
                height=350
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Return distribution
            st.subheader("📊 Return Distribution")
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Histogram with VaR lines
                fig = go.Figure()
                
                fig.add_trace(go.Histogram(
                    x=engine.portfolio_returns * 100,
                    nbinsx=50,
                    name='Returns',
                    marker_color='lightblue'
                ))
                
                # Add VaR lines
                for conf in confidence_levels:
                    var = engine.compute_var_historical(conf) * 100
                    fig.add_vline(
                        x=var,
                        line_dash="dash",
                        line_color="red",
                        annotation_text=f"VaR({int(conf*100)}%)"
                    )
                
                fig.update_layout(
                    title="Daily Return Distribution",
                    xaxis_title="Return (%)",
                    yaxis_title="Frequency",
                    showlegend=False,
                    height=350
                )
                
                st.plotly_chart(fig, use_container_width=True)
            
            with col2:
                # Q-Q plot
                from scipy import stats
                
                theoretical_quantiles = stats.norm.ppf(
                    np.linspace(0.01, 0.99, len(engine.portfolio_returns))
                )
                sample_quantiles = np.sort(engine.portfolio_returns)
                
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=theoretical_quantiles,
                    y=sample_quantiles,
                    mode='markers',
                    marker=dict(color='blue', size=3),
                    name='Returns'
                ))
                
                # Add reference line
                fig.add_trace(go.Scatter(
                    x=[theoretical_quantiles.min(), theoretical_quantiles.max()],
                    y=[theoretical_quantiles.min(), theoretical_quantiles.max()],
                    mode='lines',
                    line=dict(color='red', dash='dash'),
                    name='Normal'
                ))
                
                fig.update_layout(
                    title="Q-Q Plot (Normality Test)",
                    xaxis_title="Theoretical Quantiles",
                    yaxis_title="Sample Quantiles",
                    height=350
                )
                
                st.plotly_chart(fig, use_container_width=True)
            
            # Worst days
            st.subheader("💥 Worst 10 Days")
            
            worst_days = pd.DataFrame(report['worst_days'])
            st.dataframe(worst_days, hide_index=True, use_container_width=True)
            
            # Correlation matrix
            st.subheader("🔥 Correlation Matrix")
            
            corr = returns.corr()
            
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
                title="Asset Correlations",
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Export
            st.subheader("💾 Export Report")
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Export metrics as JSON
                import json
                json_str = json.dumps(report, indent=2, default=str)
                st.download_button(
                    label="Download Risk Metrics (JSON)",
                    data=json_str,
                    file_name=f"risk_report_{datetime.now().strftime('%Y%m%d')}.json",
                    mime="application/json"
                )
            
            with col2:
                # Export portfolio as CSV
                csv = weights_df.to_csv(index=False)
                st.download_button(
                    label="Download Portfolio (CSV)",
                    data=csv,
                    file_name=f"portfolio_{datetime.now().strftime('%Y%m%d')}.csv",
                    mime="text/csv"
                )
            
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")
            st.info("Please check your ticker symbols and date range.")

# Footer
st.markdown("---")
st.markdown("""
**Methodology:**
- **VaR (Value at Risk)**: Maximum expected loss at a given confidence level
- **CVaR (Conditional VaR)**: Expected loss in the worst cases beyond VaR
- **Historical**: Based on empirical distribution of returns
- **Parametric**: Assumes normal distribution (may underestimate tail risk)

**Data Source:** Yahoo Finance  
**Built with:** Streamlit, Plotly, SciPy
""")
