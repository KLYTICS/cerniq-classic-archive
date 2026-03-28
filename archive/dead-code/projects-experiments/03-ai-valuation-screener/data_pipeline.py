"""
Semiconductor Data Pipeline

Fetches and processes price and fundamental data for semiconductor
equipment stocks. Caches data to reduce API calls.
"""

import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import os


class SemiconductorDataPipeline:
    """
    Data pipeline for semiconductor valuation screener.

    Fetches historical prices, fundamentals, and computes
    derived metrics for cyclical valuation analysis.
    """

    # Default universe of semiconductor equipment stocks
    DEFAULT_UNIVERSE = ['LRCX', 'AMAT', 'KLAC', 'ASML', 'TER']

    # Secondary universe (customers) for cycle context
    CONTEXT_TICKERS = ['TSM', 'INTC', 'NVDA']

    def __init__(
        self,
        tickers: Optional[List[str]] = None,
        lookback_years: int = 5,
        cache_dir: str = 'data/processed'
    ):
        """
        Args:
            tickers: List of stock tickers (default: semiconductor equipment)
            lookback_years: Years of historical data to fetch
            cache_dir: Directory for caching data
        """
        self.tickers = tickers or self.DEFAULT_UNIVERSE
        self.lookback_years = lookback_years
        self.end_date = datetime.now()
        self.start_date = self.end_date - timedelta(days=365 * lookback_years)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Data storage
        self.prices: Optional[pd.DataFrame] = None
        self.fundamentals: Optional[pd.DataFrame] = None
        self.metrics: Optional[pd.DataFrame] = None

    def fetch_prices(self, force_refresh: bool = False) -> pd.DataFrame:
        """
        Download historical adjusted close prices.

        Args:
            force_refresh: If True, bypass cache

        Returns:
            DataFrame with dates as index, tickers as columns
        """
        cache_file = self.cache_dir / 'prices.parquet'

        # Check cache
        if not force_refresh and cache_file.exists():
            cached = pd.read_parquet(cache_file)
            # Check if cache is recent (within 1 day)
            if len(cached) > 0:
                last_date = pd.to_datetime(cached.index[-1])
                if (datetime.now() - last_date).days <= 1:
                    self.prices = cached
                    return self.prices

        # Fetch from yfinance
        try:
            data = yf.download(
                self.tickers,
                start=self.start_date.strftime('%Y-%m-%d'),
                end=self.end_date.strftime('%Y-%m-%d'),
                progress=False
            )

            # Handle single ticker case
            if len(self.tickers) == 1:
                self.prices = data[['Adj Close']].rename(
                    columns={'Adj Close': self.tickers[0]}
                )
            else:
                self.prices = data['Adj Close']

            # Save to cache
            self.prices.to_parquet(cache_file)

        except Exception as e:
            print(f"Error fetching prices: {e}")
            # Try to load from cache even if stale
            if cache_file.exists():
                self.prices = pd.read_parquet(cache_file)
            else:
                raise

        return self.prices

    def fetch_fundamentals(self, force_refresh: bool = False) -> pd.DataFrame:
        """
        Get current fundamental metrics for each ticker.

        Returns:
            DataFrame with fundamentals (PE, PS, market cap, etc.)
        """
        cache_file = self.cache_dir / 'fundamentals.parquet'

        # Check cache (refresh daily)
        if not force_refresh and cache_file.exists():
            cached = pd.read_parquet(cache_file)
            cache_time = os.path.getmtime(cache_file)
            cache_age_hours = (datetime.now().timestamp() - cache_time) / 3600
            if cache_age_hours < 24:
                self.fundamentals = cached
                return self.fundamentals

        fundamentals = []

        for ticker in self.tickers:
            try:
                stock = yf.Ticker(ticker)
                info = stock.info

                fundamentals.append({
                    'ticker': ticker,
                    'company_name': info.get('shortName', ticker),
                    'current_price': info.get('currentPrice') or info.get('regularMarketPrice'),
                    'pe_ratio': info.get('trailingPE'),
                    'forward_pe': info.get('forwardPE'),
                    'ps_ratio': info.get('priceToSalesTrailing12Months'),
                    'pb_ratio': info.get('priceToBook'),
                    'market_cap': info.get('marketCap'),
                    'enterprise_value': info.get('enterpriseValue'),
                    'ev_revenue': info.get('enterpriseToRevenue'),
                    'ev_ebitda': info.get('enterpriseToEbitda'),
                    'revenue': info.get('totalRevenue'),
                    'gross_margins': info.get('grossMargins'),
                    'operating_margins': info.get('operatingMargins'),
                    'profit_margins': info.get('profitMargins'),
                    'eps_ttm': info.get('trailingEps'),
                    'eps_forward': info.get('forwardEps'),
                    'revenue_growth': info.get('revenueGrowth'),
                    'earnings_growth': info.get('earningsGrowth'),
                    'beta': info.get('beta'),
                    'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
                    'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
                    'fifty_day_avg': info.get('fiftyDayAverage'),
                    'two_hundred_day_avg': info.get('twoHundredDayAverage'),
                })

            except Exception as e:
                print(f"Error fetching fundamentals for {ticker}: {e}")
                fundamentals.append({'ticker': ticker})

        self.fundamentals = pd.DataFrame(fundamentals).set_index('ticker')

        # Save to cache
        self.fundamentals.to_parquet(cache_file)

        return self.fundamentals

    def compute_returns(self) -> pd.DataFrame:
        """Compute daily returns from prices."""
        if self.prices is None:
            self.fetch_prices()
        return self.prices.pct_change().dropna()

    def compute_historical_metrics(self) -> pd.DataFrame:
        """
        Compute historical valuation metrics over time.

        Returns:
            DataFrame with rolling PE, momentum, and percentiles
        """
        if self.prices is None:
            self.fetch_prices()
        if self.fundamentals is None:
            self.fetch_fundamentals()

        metrics = {}

        for ticker in self.tickers:
            if ticker not in self.prices.columns:
                continue

            price = self.prices[ticker]

            # Moving averages
            ma_50 = price.rolling(50).mean()
            ma_200 = price.rolling(200).mean()

            # Price momentum (90-day return)
            momentum_90d = price.pct_change(90)

            # Momentum acceleration (change in momentum)
            momentum_30d = price.pct_change(30)
            momentum_accel = momentum_30d - momentum_30d.shift(30)

            # Relative strength (price vs 52-week range)
            rolling_high = price.rolling(252).max()
            rolling_low = price.rolling(252).min()
            relative_strength = (price - rolling_low) / (rolling_high - rolling_low)

            # Price distance from moving averages
            dist_from_ma50 = (price - ma_50) / ma_50
            dist_from_ma200 = (price - ma_200) / ma_200

            metrics[ticker] = pd.DataFrame({
                'price': price,
                'ma_50': ma_50,
                'ma_200': ma_200,
                'momentum_90d': momentum_90d,
                'momentum_30d': momentum_30d,
                'momentum_accel': momentum_accel,
                'relative_strength': relative_strength,
                'dist_from_ma50': dist_from_ma50,
                'dist_from_ma200': dist_from_ma200,
            })

        self.metrics = metrics
        return metrics

    def compute_percentiles(self) -> pd.DataFrame:
        """
        Compute historical percentiles for PE and price metrics.

        Returns:
            DataFrame with percentile rankings for each ticker
        """
        if self.prices is None:
            self.fetch_prices()
        if self.fundamentals is None:
            self.fetch_fundamentals()

        percentiles = []

        for ticker in self.tickers:
            if ticker not in self.prices.columns:
                continue

            price = self.prices[ticker].dropna()

            # Price percentiles (within lookback period)
            current_price = price.iloc[-1]
            price_percentile = (price < current_price).mean() * 100

            # Get current PE from fundamentals
            current_pe = self.fundamentals.loc[ticker, 'pe_ratio'] if ticker in self.fundamentals.index else None

            percentiles.append({
                'ticker': ticker,
                'current_price': current_price,
                'price_percentile': price_percentile,
                'price_p10': price.quantile(0.10),
                'price_p25': price.quantile(0.25),
                'price_p50': price.quantile(0.50),
                'price_p75': price.quantile(0.75),
                'price_p90': price.quantile(0.90),
                'current_pe': current_pe,
            })

        return pd.DataFrame(percentiles).set_index('ticker')

    def get_correlation_matrix(self) -> pd.DataFrame:
        """Compute correlation matrix of returns."""
        returns = self.compute_returns()
        return returns.corr()

    def get_summary(self) -> Dict:
        """
        Get summary of all data.

        Returns:
            Dictionary with prices, fundamentals, and metrics
        """
        if self.prices is None:
            self.fetch_prices()
        if self.fundamentals is None:
            self.fetch_fundamentals()
        if self.metrics is None:
            self.compute_historical_metrics()

        return {
            'prices': self.prices,
            'fundamentals': self.fundamentals,
            'metrics': self.metrics,
            'percentiles': self.compute_percentiles(),
            'correlations': self.get_correlation_matrix(),
            'data_range': {
                'start': self.prices.index[0].strftime('%Y-%m-%d'),
                'end': self.prices.index[-1].strftime('%Y-%m-%d'),
                'days': len(self.prices)
            }
        }

    def save_to_cache(self, filename: str = 'semiconductor_data.parquet') -> Path:
        """
        Save all data to a single parquet file.

        Returns:
            Path to saved file
        """
        if self.prices is None:
            self.fetch_prices()
        if self.fundamentals is None:
            self.fetch_fundamentals()

        cache_path = self.cache_dir / filename

        # Combine into single dataframe for storage
        combined = self.prices.copy()
        combined.to_parquet(cache_path)

        return cache_path

    def load_from_cache(self, filename: str = 'semiconductor_data.parquet') -> bool:
        """
        Load data from cache.

        Returns:
            True if loaded successfully, False otherwise
        """
        cache_path = self.cache_dir / filename

        if not cache_path.exists():
            return False

        try:
            self.prices = pd.read_parquet(cache_path)
            return True
        except Exception as e:
            print(f"Error loading cache: {e}")
            return False


def fetch_sector_data(sector: str = 'semiconductor') -> SemiconductorDataPipeline:
    """
    Convenience function to fetch data for a sector.

    Args:
        sector: Sector name ('semiconductor' is default)

    Returns:
        Initialized and loaded data pipeline
    """
    pipeline = SemiconductorDataPipeline()
    pipeline.fetch_prices()
    pipeline.fetch_fundamentals()
    pipeline.compute_historical_metrics()

    return pipeline
