"""
Valuation Engine

Computes fair value estimates and opportunity scores for semiconductor
stocks using mid-cycle normalization and regime-adjusted multiples.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from regime_detector import (
    CycleRegime,
    CycleRegimeDetector,
    REGIME_CONFIG
)


@dataclass
class ValuationResult:
    """Container for valuation analysis results."""
    ticker: str
    current_price: float
    fair_value: float
    upside_pct: float
    score: float
    regime: CycleRegime
    pe_current: Optional[float]
    pe_percentile: float
    momentum_score: float
    quality_score: float
    technical_score: float
    risk_level: str
    signal: str  # 'Buy', 'Hold', 'Sell', 'Watch'


class ValuationEngine:
    """
    Multi-regime valuation engine for cyclical stocks.

    Combines:
    - Mid-cycle earnings normalization
    - Regime-adjusted PE multiples
    - Multi-factor scoring (valuation, momentum, quality, technical)
    """

    # Scoring weights
    WEIGHTS = {
        'valuation': 0.40,
        'momentum': 0.30,
        'quality': 0.20,
        'technical': 0.10
    }

    def __init__(self):
        self.regime_detector = CycleRegimeDetector()

    def compute_mid_cycle_pe(
        self,
        pe_history: pd.Series,
        percentile_clip: Tuple[float, float] = (0.05, 0.95)
    ) -> float:
        """
        Compute mid-cycle (normalized) PE ratio.

        Clips outliers and takes the average to get a "normal" PE.

        Args:
            pe_history: Historical PE ratios
            percentile_clip: Percentiles to clip (low, high)

        Returns:
            Mid-cycle PE ratio
        """
        pe_clean = pe_history.dropna()

        if len(pe_clean) < 10:
            return pe_clean.mean() if len(pe_clean) > 0 else 15.0

        # Clip outliers
        low_clip = pe_clean.quantile(percentile_clip[0])
        high_clip = pe_clean.quantile(percentile_clip[1])
        pe_clipped = pe_clean.clip(lower=low_clip, upper=high_clip)

        return pe_clipped.mean()

    def compute_fair_value(
        self,
        current_eps: float,
        mid_cycle_pe: float,
        regime: CycleRegime
    ) -> float:
        """
        Compute regime-adjusted fair value.

        Fair Value = Mid-Cycle EPS × Regime PE Multiple

        Args:
            current_eps: Current trailing 12-month EPS
            mid_cycle_pe: Normalized mid-cycle PE ratio
            regime: Current cycle regime

        Returns:
            Fair value estimate
        """
        regime_multiple = REGIME_CONFIG[regime]['pe_multiple_mid']

        # Blend mid-cycle PE with regime multiple
        # Use regime multiple if cycle position is extreme
        if regime in [CycleRegime.EARLY, CycleRegime.TROUGH]:
            # In early/trough, use higher multiple (recovery expected)
            adjusted_pe = max(mid_cycle_pe, regime_multiple)
        elif regime == CycleRegime.LATE:
            # In late cycle, use lower multiple (downturn expected)
            adjusted_pe = min(mid_cycle_pe, regime_multiple)
        else:
            # Mid cycle - use average
            adjusted_pe = (mid_cycle_pe + regime_multiple) / 2

        return current_eps * adjusted_pe

    def score_valuation(
        self,
        current_price: float,
        fair_value: float,
        pe_percentile: float
    ) -> float:
        """
        Compute valuation score (0-100).

        Higher score = more undervalued.

        Args:
            current_price: Current stock price
            fair_value: Computed fair value
            pe_percentile: Current PE as percentile of history

        Returns:
            Valuation score 0-100
        """
        # Upside component (max 60 points)
        upside = (fair_value - current_price) / current_price
        upside_score = min(max((upside + 0.20) / 0.60, 0), 1) * 60

        # PE percentile component (max 40 points)
        # Lower percentile = more undervalued = higher score
        pe_score = (1 - pe_percentile / 100) * 40

        return upside_score + pe_score

    def score_momentum(
        self,
        momentum_90d: float,
        momentum_accel: float,
        relative_strength: float
    ) -> float:
        """
        Compute momentum score (0-100).

        Args:
            momentum_90d: 90-day price return
            momentum_accel: Change in momentum (acceleration)
            relative_strength: Position in 52-week range (0-1)

        Returns:
            Momentum score 0-100
        """
        # 90-day momentum (40 points)
        mom_score = min(max((momentum_90d + 0.30) / 0.60, 0), 1) * 40

        # Momentum acceleration (30 points)
        accel_score = min(max((momentum_accel + 0.10) / 0.20, 0), 1) * 30

        # Relative strength (30 points)
        rs_score = relative_strength * 30

        return mom_score + accel_score + rs_score

    def score_quality(
        self,
        operating_margin: Optional[float],
        revenue_growth: Optional[float],
        gross_margin: Optional[float]
    ) -> float:
        """
        Compute quality score (0-100).

        Args:
            operating_margin: Operating profit margin
            revenue_growth: Year-over-year revenue growth
            gross_margin: Gross profit margin

        Returns:
            Quality score 0-100
        """
        score = 50.0  # Default to neutral

        # Operating margin (40 points)
        if operating_margin is not None:
            # Semiconductor equipment typically has 20-35% operating margins
            op_score = min(max((operating_margin - 0.15) / 0.25, 0), 1) * 40
            score = op_score
        else:
            score = 20  # Conservative default

        # Revenue growth (35 points)
        if revenue_growth is not None:
            growth_score = min(max((revenue_growth + 0.20) / 0.60, 0), 1) * 35
            score += growth_score
        else:
            score += 17.5

        # Gross margin (25 points)
        if gross_margin is not None:
            gm_score = min(max((gross_margin - 0.30) / 0.30, 0), 1) * 25
            score += gm_score
        else:
            score += 12.5

        return score

    def score_technical(self, indicators: Dict) -> float:
        """
        Compute technical score (0-100).

        Args:
            indicators: Dictionary of technical indicators

        Returns:
            Technical score 0-100
        """
        score = 0.0

        # Price vs MA50 (25 points)
        if indicators.get('price_above_ma_short'):
            score += 25

        # Price vs MA200 (25 points)
        if indicators.get('price_above_ma_long'):
            score += 25

        # MA crossover (25 points)
        if indicators.get('ma_short_above_ma_long'):
            score += 25

        # Relative strength (25 points)
        rs = indicators.get('relative_strength', 0.5)
        score += rs * 25

        return score

    def compute_composite_score(
        self,
        valuation_score: float,
        momentum_score: float,
        quality_score: float,
        technical_score: float
    ) -> float:
        """
        Compute weighted composite score.

        Returns:
            Composite score 0-100
        """
        return (
            self.WEIGHTS['valuation'] * valuation_score +
            self.WEIGHTS['momentum'] * momentum_score +
            self.WEIGHTS['quality'] * quality_score +
            self.WEIGHTS['technical'] * technical_score
        )

    def get_signal(
        self,
        score: float,
        regime: CycleRegime,
        pe_percentile: float
    ) -> str:
        """
        Generate trading signal based on score and regime.

        Returns:
            Signal: 'Buy', 'Hold', 'Sell', or 'Watch'
        """
        if score >= 75 and regime in [CycleRegime.EARLY, CycleRegime.MID]:
            return 'Buy'
        elif score >= 70 and pe_percentile < 30:
            return 'Buy'
        elif score < 35 and regime == CycleRegime.LATE:
            return 'Sell'
        elif score < 40 and pe_percentile > 75:
            return 'Sell'
        elif score >= 50:
            return 'Hold'
        else:
            return 'Watch'

    def analyze_stock(
        self,
        ticker: str,
        prices: pd.Series,
        fundamentals: pd.Series,
        price_percentile: float
    ) -> ValuationResult:
        """
        Perform complete valuation analysis for a single stock.

        Args:
            ticker: Stock ticker
            prices: Historical price series
            fundamentals: Current fundamental data
            price_percentile: Current price as percentile of history

        Returns:
            ValuationResult with all metrics
        """
        # Detect regime
        regime, indicators = self.regime_detector.detect_regime(prices)

        # Get current values
        current_price = prices.iloc[-1]
        pe_current = fundamentals.get('pe_ratio')
        eps_ttm = fundamentals.get('eps_ttm')

        # Default PE percentile to price percentile if PE not available
        pe_percentile = price_percentile

        # Compute fair value
        if eps_ttm and eps_ttm > 0:
            # Use regime-adjusted valuation
            mid_cycle_pe = 15.0  # Default for semiconductor equipment
            fair_value = self.compute_fair_value(eps_ttm, mid_cycle_pe, regime)
        else:
            # Fallback: use historical price average as fair value
            fair_value = prices.mean()

        upside_pct = (fair_value - current_price) / current_price * 100

        # Compute component scores
        valuation_score = self.score_valuation(
            current_price, fair_value, pe_percentile
        )

        momentum_score = self.score_momentum(
            indicators.get('momentum', 0),
            indicators.get('momentum_accel', 0),
            indicators.get('relative_strength', 0.5)
        )

        quality_score = self.score_quality(
            fundamentals.get('operating_margins'),
            fundamentals.get('revenue_growth'),
            fundamentals.get('gross_margins')
        )

        technical_score = self.score_technical(indicators)

        # Composite score
        composite_score = self.compute_composite_score(
            valuation_score, momentum_score, quality_score, technical_score
        )

        # Generate signal
        signal = self.get_signal(composite_score, regime, pe_percentile)

        return ValuationResult(
            ticker=ticker,
            current_price=current_price,
            fair_value=fair_value,
            upside_pct=upside_pct,
            score=composite_score,
            regime=regime,
            pe_current=pe_current,
            pe_percentile=pe_percentile,
            momentum_score=momentum_score,
            quality_score=quality_score,
            technical_score=technical_score,
            risk_level=REGIME_CONFIG[regime]['risk_level'],
            signal=signal
        )

    def rank_opportunities(
        self,
        results: List[ValuationResult]
    ) -> pd.DataFrame:
        """
        Rank stocks by composite score.

        Args:
            results: List of ValuationResult objects

        Returns:
            DataFrame sorted by score (highest first)
        """
        data = []
        for r in results:
            data.append({
                'Ticker': r.ticker,
                'Score': r.score,
                'Signal': r.signal,
                'Price': r.current_price,
                'Fair Value': r.fair_value,
                'Upside %': r.upside_pct,
                'Regime': r.regime.value,
                'PE': r.pe_current,
                'PE %ile': r.pe_percentile,
                'Momentum': r.momentum_score,
                'Quality': r.quality_score,
                'Technical': r.technical_score,
                'Risk': r.risk_level
            })

        df = pd.DataFrame(data)
        df = df.sort_values('Score', ascending=False)
        df['Rank'] = range(1, len(df) + 1)

        return df[['Rank', 'Ticker', 'Score', 'Signal', 'Price', 'Fair Value',
                   'Upside %', 'Regime', 'PE', 'Risk']]


def screen_universe(
    prices: pd.DataFrame,
    fundamentals: pd.DataFrame,
    min_score: float = 0
) -> pd.DataFrame:
    """
    Screen entire universe and return ranked opportunities.

    Args:
        prices: DataFrame of historical prices (tickers as columns)
        fundamentals: DataFrame of fundamentals (tickers as index)
        min_score: Minimum score threshold

    Returns:
        Ranked DataFrame of opportunities
    """
    engine = ValuationEngine()
    results = []

    for ticker in prices.columns:
        try:
            # Compute price percentile
            price_series = prices[ticker].dropna()

            # Skip if insufficient data
            if len(price_series) < 50:
                continue

            current_price = price_series.iloc[-1]
            price_percentile = (price_series < current_price).mean() * 100

            # Get fundamentals (use empty Series if not available)
            if ticker in fundamentals.index:
                fund_data = fundamentals.loc[ticker]
            else:
                fund_data = pd.Series(dtype=float)

            # Analyze
            result = engine.analyze_stock(
                ticker=ticker,
                prices=price_series,
                fundamentals=fund_data,
                price_percentile=price_percentile
            )

            if result.score >= min_score:
                results.append(result)

        except Exception as e:
            # Skip problematic tickers
            continue

    return engine.rank_opportunities(results)
