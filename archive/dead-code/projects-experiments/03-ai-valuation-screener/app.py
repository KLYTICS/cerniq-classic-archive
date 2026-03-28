"""
AI Semiconductor Valuation Screener
Unified Dashboard with Predictions, Backtesting, and Monte Carlo
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import yfinance as yf
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from regime_detector import CycleRegimeDetector, CycleRegime, REGIME_CONFIG

# Page config
st.set_page_config(
    page_title="AI Semiconductor Screener",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better UI
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 0.5rem;
    }
    .sub-header {
        font-size: 1.1rem;
        color: #6b7280;
        margin-bottom: 2rem;
    }
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.5rem;
        border-radius: 12px;
        color: white;
    }
    .stock-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 0.5rem 0;
    }
    .buy-signal {
        background: #dcfce7;
        color: #166534;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
    }
    .sell-signal {
        background: #fee2e2;
        color: #991b1b;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
    }
    .hold-signal {
        background: #dbeafe;
        color: #1e40af;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: 600;
    }
    div[data-testid="stMetricValue"] {
        font-size: 1.8rem;
        font-weight: 700;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        padding: 10px 20px;
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)


# ============== DATA FUNCTIONS ==============

@st.cache_data(ttl=1800, show_spinner=False)
def fetch_stock_data(tickers: tuple, period: str = "2y") -> pd.DataFrame:
    """Fetch stock data with robust error handling."""
    try:
        data = yf.download(
            list(tickers),
            period=period,
            progress=False,
            threads=True
        )

        if data.empty:
            return pd.DataFrame()

        # Handle multi-level columns
        if isinstance(data.columns, pd.MultiIndex):
            prices = data['Adj Close']
        else:
            prices = data[['Adj Close']]
            prices.columns = list(tickers)

        return prices.dropna(how='all')

    except Exception as e:
        st.warning(f"Data fetch issue: {str(e)[:100]}")
        return pd.DataFrame()


@st.cache_data(ttl=3600, show_spinner=False)
def fetch_stock_info(ticker: str) -> dict:
    """Fetch fundamental data for a single stock."""
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        return {
            'name': info.get('shortName', ticker),
            'price': info.get('currentPrice') or info.get('regularMarketPrice', 0),
            'pe': info.get('trailingPE'),
            'forward_pe': info.get('forwardPE'),
            'ps': info.get('priceToSalesTrailing12Months'),
            'market_cap': info.get('marketCap', 0),
            'revenue': info.get('totalRevenue', 0),
            'eps': info.get('trailingEps'),
            'revenue_growth': info.get('revenueGrowth'),
            'profit_margin': info.get('profitMargins'),
            'beta': info.get('beta'),
            '52w_high': info.get('fiftyTwoWeekHigh', 0),
            '52w_low': info.get('fiftyTwoWeekLow', 0),
            'avg_volume': info.get('averageVolume', 0),
        }
    except Exception:
        return {'name': ticker, 'price': 0}


def compute_technicals(prices: pd.Series) -> dict:
    """Compute technical indicators."""
    if len(prices) < 50:
        return {}

    current = prices.iloc[-1]

    # Moving averages
    ma_20 = prices.rolling(20).mean().iloc[-1]
    ma_50 = prices.rolling(50).mean().iloc[-1]
    ma_200 = prices.rolling(200).mean().iloc[-1] if len(prices) >= 200 else ma_50

    # RSI
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    rsi = (100 - (100 / (1 + rs))).iloc[-1]

    # Momentum
    mom_20 = (current / prices.iloc[-20] - 1) * 100 if len(prices) >= 20 else 0
    mom_60 = (current / prices.iloc[-60] - 1) * 100 if len(prices) >= 60 else 0

    # Volatility
    returns = prices.pct_change()
    vol_20 = returns.rolling(20).std().iloc[-1] * np.sqrt(252) * 100

    # Price position
    high_52w = prices.rolling(252).max().iloc[-1] if len(prices) >= 252 else prices.max()
    low_52w = prices.rolling(252).min().iloc[-1] if len(prices) >= 252 else prices.min()
    range_pos = (current - low_52w) / (high_52w - low_52w) * 100 if high_52w != low_52w else 50

    return {
        'price': current,
        'ma_20': ma_20,
        'ma_50': ma_50,
        'ma_200': ma_200,
        'rsi': rsi,
        'momentum_20d': mom_20,
        'momentum_60d': mom_60,
        'volatility': vol_20,
        'range_position': range_pos,
        'above_ma20': current > ma_20,
        'above_ma50': current > ma_50,
        'above_ma200': current > ma_200,
    }


def compute_score(technicals: dict, info: dict) -> dict:
    """Compute composite valuation score."""
    score = 50  # Base score
    signals = []

    # Technical signals
    if technicals.get('rsi', 50) < 30:
        score += 15
        signals.append("RSI Oversold")
    elif technicals.get('rsi', 50) > 70:
        score -= 15
        signals.append("RSI Overbought")

    if technicals.get('above_ma50'):
        score += 10
        signals.append("Above MA50")
    else:
        score -= 10
        signals.append("Below MA50")

    if technicals.get('above_ma200'):
        score += 10
        signals.append("Uptrend (>MA200)")
    else:
        score -= 5

    # Momentum
    mom = technicals.get('momentum_20d', 0)
    if mom > 10:
        score += 10
        signals.append(f"Strong Momentum +{mom:.0f}%")
    elif mom < -10:
        score -= 10
        signals.append(f"Weak Momentum {mom:.0f}%")

    # Range position
    range_pos = technicals.get('range_position', 50)
    if range_pos < 25:
        score += 10
        signals.append("Near 52w Low")
    elif range_pos > 80:
        score -= 5
        signals.append("Near 52w High")

    # Valuation
    pe = info.get('pe')
    if pe and pe < 15:
        score += 10
        signals.append(f"Low PE ({pe:.1f})")
    elif pe and pe > 35:
        score -= 10
        signals.append(f"High PE ({pe:.1f})")

    # Clamp score
    score = max(0, min(100, score))

    # Signal
    if score >= 70:
        signal = "Buy"
    elif score >= 55:
        signal = "Hold"
    elif score >= 40:
        signal = "Watch"
    else:
        signal = "Sell"

    return {
        'score': score,
        'signal': signal,
        'reasons': signals[:4]  # Top 4 reasons
    }


# ============== UI COMPONENTS ==============

def render_stock_card(ticker: str, prices: pd.Series, rank: int):
    """Render a stock analysis card."""
    info = fetch_stock_info(ticker)
    technicals = compute_technicals(prices)
    scoring = compute_score(technicals, info)

    # Regime detection
    detector = CycleRegimeDetector()
    regime, indicators = detector.detect_regime(prices)
    regime_config = REGIME_CONFIG[regime]

    with st.container():
        col1, col2, col3, col4 = st.columns([1, 2, 2, 1])

        with col1:
            st.markdown(f"### #{rank}")
            st.markdown(f"**{ticker}**")
            st.caption(info.get('name', ticker)[:20])

        with col2:
            price = technicals.get('price', info.get('price', 0))
            change = technicals.get('momentum_20d', 0)
            st.metric(
                "Price",
                f"${price:,.2f}" if price else "N/A",
                f"{change:+.1f}% (20d)" if change else None
            )

        with col3:
            st.metric("Score", f"{scoring['score']:.0f}/100")
            signal_class = scoring['signal'].lower()
            st.markdown(f"<span class='{signal_class}-signal'>{scoring['signal']}</span>",
                       unsafe_allow_html=True)

        with col4:
            st.markdown(f"<span style='color:{regime_config['color']}'>{regime.value}</span>",
                       unsafe_allow_html=True)
            st.caption(f"Risk: {regime_config['risk_level']}")

        # Expandable details
        with st.expander("View Details"):
            detail_col1, detail_col2, detail_col3 = st.columns(3)

            with detail_col1:
                st.markdown("**Technicals**")
                st.write(f"RSI: {technicals.get('rsi', 0):.1f}")
                st.write(f"Volatility: {technicals.get('volatility', 0):.1f}%")
                st.write(f"52w Range: {technicals.get('range_position', 0):.0f}%")

            with detail_col2:
                st.markdown("**Fundamentals**")
                pe = info.get('pe')
                st.write(f"P/E: {pe:.1f}" if pe else "P/E: N/A")
                mc = info.get('market_cap', 0)
                st.write(f"Mkt Cap: ${mc/1e9:.1f}B" if mc else "Mkt Cap: N/A")
                rg = info.get('revenue_growth')
                st.write(f"Rev Growth: {rg*100:.1f}%" if rg else "Rev Growth: N/A")

            with detail_col3:
                st.markdown("**Signals**")
                for reason in scoring['reasons']:
                    st.write(f"• {reason}")

        st.divider()

    return {
        'ticker': ticker,
        'name': info.get('name', ticker),
        'price': technicals.get('price', 0),
        'score': scoring['score'],
        'signal': scoring['signal'],
        'regime': regime.value,
        'rsi': technicals.get('rsi', 0),
        'momentum': technicals.get('momentum_20d', 0),
        'pe': info.get('pe'),
    }


def render_price_chart(prices: pd.DataFrame, ticker: str):
    """Render interactive price chart."""
    if ticker not in prices.columns:
        st.warning(f"No data for {ticker}")
        return

    price = prices[ticker].dropna()

    # Create figure with secondary y-axis
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.1,
        row_heights=[0.7, 0.3],
        subplot_titles=(f'{ticker} Price', 'RSI')
    )

    # Price with MAs
    fig.add_trace(
        go.Scatter(x=price.index, y=price.values, name='Price',
                  line=dict(color='#2563eb', width=2)),
        row=1, col=1
    )

    ma_20 = price.rolling(20).mean()
    ma_50 = price.rolling(50).mean()

    fig.add_trace(
        go.Scatter(x=ma_20.index, y=ma_20.values, name='MA 20',
                  line=dict(color='#f59e0b', width=1, dash='dash')),
        row=1, col=1
    )

    fig.add_trace(
        go.Scatter(x=ma_50.index, y=ma_50.values, name='MA 50',
                  line=dict(color='#10b981', width=1, dash='dash')),
        row=1, col=1
    )

    # RSI
    delta = price.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))

    fig.add_trace(
        go.Scatter(x=rsi.index, y=rsi.values, name='RSI',
                  line=dict(color='#8b5cf6', width=1)),
        row=2, col=1
    )

    # RSI levels
    fig.add_hline(y=70, line_dash="dash", line_color="red", row=2, col=1)
    fig.add_hline(y=30, line_dash="dash", line_color="green", row=2, col=1)

    fig.update_layout(
        height=500,
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=0, r=0, t=30, b=0)
    )

    fig.update_yaxes(title_text="Price ($)", row=1, col=1)
    fig.update_yaxes(title_text="RSI", row=2, col=1, range=[0, 100])

    st.plotly_chart(fig, use_container_width=True)


def render_comparison_chart(prices: pd.DataFrame):
    """Render normalized performance comparison."""
    if prices.empty:
        return

    # Normalize to 100
    normalized = (prices / prices.iloc[0]) * 100

    fig = go.Figure()

    colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
              '#06b6d4', '#ec4899', '#84cc16']

    for i, col in enumerate(normalized.columns):
        fig.add_trace(go.Scatter(
            x=normalized.index,
            y=normalized[col].values,
            name=col,
            line=dict(color=colors[i % len(colors)], width=2)
        ))

    fig.add_hline(y=100, line_dash="dash", line_color="gray", opacity=0.5)

    fig.update_layout(
        title="Normalized Performance (Base = 100)",
        xaxis_title="Date",
        yaxis_title="Indexed Value",
        height=400,
        hovermode='x unified',
        legend=dict(orientation="h", yanchor="bottom", y=1.02)
    )

    st.plotly_chart(fig, use_container_width=True)


def render_monte_carlo(prices: pd.Series, ticker: str):
    """Render Monte Carlo simulation results."""
    returns = prices.pct_change().dropna()

    if len(returns) < 60:
        st.warning("Insufficient data for Monte Carlo simulation")
        return

    # Parameters
    n_simulations = 1000
    horizon = 60  # 60 trading days (~3 months)
    initial_value = 10000

    # Historical parameters
    mu = returns.mean()
    sigma = returns.std()

    # Simulate
    np.random.seed(42)
    simulations = np.zeros((n_simulations, horizon + 1))
    simulations[:, 0] = initial_value

    for t in range(1, horizon + 1):
        random_returns = np.random.normal(mu, sigma, n_simulations)
        simulations[:, t] = simulations[:, t-1] * (1 + random_returns)

    final_values = simulations[:, -1]

    # Statistics
    mean_final = np.mean(final_values)
    median_final = np.median(final_values)
    var_95 = np.percentile(final_values, 5)
    best_case = np.percentile(final_values, 95)
    prob_profit = np.mean(final_values > initial_value) * 100

    # Display
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Expected Value", f"${mean_final:,.0f}")
    with col2:
        st.metric("95% VaR", f"${var_95:,.0f}",
                 f"{(var_95/initial_value - 1)*100:+.1f}%")
    with col3:
        st.metric("Upside (95%)", f"${best_case:,.0f}",
                 f"{(best_case/initial_value - 1)*100:+.1f}%")
    with col4:
        st.metric("P(Profit)", f"{prob_profit:.0f}%")

    # Plot
    fig = go.Figure()

    # Sample paths
    for i in range(min(100, n_simulations)):
        fig.add_trace(go.Scatter(
            x=list(range(horizon + 1)),
            y=simulations[i],
            mode='lines',
            line=dict(color='rgba(100, 100, 200, 0.1)', width=1),
            showlegend=False
        ))

    # Mean path
    mean_path = np.mean(simulations, axis=0)
    fig.add_trace(go.Scatter(
        x=list(range(horizon + 1)),
        y=mean_path,
        mode='lines',
        name='Expected',
        line=dict(color='blue', width=3)
    ))

    # Percentile bands
    p5 = np.percentile(simulations, 5, axis=0)
    p95 = np.percentile(simulations, 95, axis=0)

    fig.add_trace(go.Scatter(
        x=list(range(horizon + 1)),
        y=p95,
        mode='lines',
        name='95th Percentile',
        line=dict(color='green', width=2, dash='dash')
    ))

    fig.add_trace(go.Scatter(
        x=list(range(horizon + 1)),
        y=p5,
        mode='lines',
        name='5th Percentile',
        line=dict(color='red', width=2, dash='dash')
    ))

    fig.add_hline(y=initial_value, line_dash="dot", line_color="gray")

    fig.update_layout(
        title=f"Monte Carlo Simulation: {ticker} (60-day forecast, $10K initial)",
        xaxis_title="Trading Days",
        yaxis_title="Portfolio Value ($)",
        height=400,
        showlegend=True
    )

    st.plotly_chart(fig, use_container_width=True)


# ============== MAIN APP ==============

def main():
    # Header
    st.markdown('<p class="main-header">📊 AI Semiconductor Screener</p>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">Quantitative analysis with regime detection, scoring, and forecasting</p>', unsafe_allow_html=True)

    # Sidebar
    st.sidebar.header("⚙️ Settings")

    # Stock selection
    all_tickers = ['NVDA', 'AMD', 'INTC', 'TSM', 'ASML', 'LRCX', 'AMAT', 'KLAC', 'MU', 'QCOM', 'AVGO', 'TXN']

    selected = st.sidebar.multiselect(
        "Select Stocks",
        options=all_tickers,
        default=['NVDA', 'AMD', 'ASML', 'LRCX', 'TSM'],
        help="Choose stocks to analyze"
    )

    period = st.sidebar.selectbox(
        "Data Period",
        options=['1y', '2y', '5y'],
        index=1,
        help="Historical data range"
    )

    if not selected:
        st.info("👈 Select at least one stock from the sidebar to begin analysis")
        return

    # Fetch data
    with st.spinner(f"Loading data for {len(selected)} stocks..."):
        prices = fetch_stock_data(tuple(selected), period)

    if prices.empty:
        st.error("❌ Could not fetch data. Please check your internet connection and try again.")
        st.info("**Troubleshooting:**\n- Check internet connection\n- Try fewer stocks\n- Try a shorter period")
        return

    # Available tickers (successfully fetched)
    available = [t for t in selected if t in prices.columns]

    if not available:
        st.error("No data available for selected stocks")
        return

    st.success(f"✓ Loaded {len(prices)} days of data for {len(available)} stocks")

    # Tabs
    tab1, tab2, tab3, tab4 = st.tabs(["📊 Screener", "📈 Charts", "🎲 Forecast", "📋 Data"])

    # ========== TAB 1: SCREENER ==========
    with tab1:
        st.subheader("Stock Rankings")

        # Analyze all stocks
        results = []
        for i, ticker in enumerate(available, 1):
            if ticker in prices.columns:
                result = render_stock_card(ticker, prices[ticker], i)
                results.append(result)

        # Summary
        if results:
            st.subheader("Summary")

            df = pd.DataFrame(results)
            df = df.sort_values('score', ascending=False)

            col1, col2, col3 = st.columns(3)

            with col1:
                buy_count = len(df[df['signal'] == 'Buy'])
                st.metric("Buy Signals", buy_count, f"of {len(df)} stocks")

            with col2:
                avg_score = df['score'].mean()
                st.metric("Average Score", f"{avg_score:.0f}")

            with col3:
                avg_mom = df['momentum'].mean()
                st.metric("Avg 20d Momentum", f"{avg_mom:+.1f}%")

    # ========== TAB 2: CHARTS ==========
    with tab2:
        st.subheader("Performance Comparison")
        render_comparison_chart(prices[available])

        st.subheader("Individual Stock Analysis")
        selected_chart = st.selectbox("Select Stock", available)

        if selected_chart:
            render_price_chart(prices, selected_chart)

    # ========== TAB 3: FORECAST ==========
    with tab3:
        st.subheader("Monte Carlo Simulation")
        st.markdown("*Probabilistic forecast based on historical volatility*")

        forecast_ticker = st.selectbox("Select Stock for Forecast", available, key="forecast")

        if forecast_ticker and forecast_ticker in prices.columns:
            render_monte_carlo(prices[forecast_ticker], forecast_ticker)

            st.info("""
            **How to interpret:**
            - Blue line = Expected path (mean of all simulations)
            - Green dashed = Best case (95th percentile)
            - Red dashed = Worst case (5th percentile)
            - VaR shows maximum expected loss at 95% confidence
            """)

    # ========== TAB 4: DATA ==========
    with tab4:
        st.subheader("Raw Data")

        # Price data
        st.markdown("**Recent Prices**")
        st.dataframe(
            prices[available].tail(20).style.format("${:.2f}"),
            use_container_width=True
        )

        # Returns
        st.markdown("**Daily Returns**")
        returns = prices[available].pct_change().tail(20)
        st.dataframe(
            returns.style.format("{:.2%}").background_gradient(cmap='RdYlGn', axis=None),
            use_container_width=True
        )

        # Correlation
        st.markdown("**Correlation Matrix**")
        corr = prices[available].pct_change().corr()

        fig = go.Figure(data=go.Heatmap(
            z=corr.values,
            x=corr.columns,
            y=corr.index,
            colorscale='RdBu',
            zmid=0,
            text=corr.values.round(2),
            texttemplate='%{text}',
            textfont={"size": 12}
        ))
        fig.update_layout(height=400)
        st.plotly_chart(fig, use_container_width=True)

        # Download
        st.markdown("**Export**")
        csv = prices[available].to_csv()
        st.download_button(
            "📥 Download Price Data (CSV)",
            csv,
            f"stock_prices_{datetime.now().strftime('%Y%m%d')}.csv",
            "text/csv"
        )

    # Footer
    st.divider()
    st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M')} | Data: Yahoo Finance")


if __name__ == "__main__":
    main()
