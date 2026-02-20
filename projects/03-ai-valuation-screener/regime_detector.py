"""
Cycle Regime Detector

Detects the current position in the semiconductor capital expenditure cycle
using price momentum, moving averages, and relative strength indicators.
"""

import numpy as np
import pandas as pd
from typing import Dict, Tuple, Optional
from enum import Enum


class CycleRegime(Enum):
    """Semiconductor cycle regimes."""
    EARLY = "Early Cycle"
    MID = "Mid Cycle"
    LATE = "Late Cycle"
    TROUGH = "Trough"


# Regime characteristics and valuation multiples
REGIME_CONFIG = {
    CycleRegime.EARLY: {
        'description': 'Recovery phase with accelerating momentum',
        'pe_multiple_range': (15, 20),
        'pe_multiple_mid': 17.5,
        'risk_level': 'Medium',
        'color': '#2ecc71'  # Green
    },
    CycleRegime.MID: {
        'description': 'Steady growth, high utilization',
        'pe_multiple_range': (12, 15),
        'pe_multiple_mid': 13.5,
        'risk_level': 'Low',
        'color': '#3498db'  # Blue
    },
    CycleRegime.LATE: {
        'description': 'Decelerating growth, peak valuations',
        'pe_multiple_range': (8, 12),
        'pe_multiple_mid': 10,
        'risk_level': 'High',
        'color': '#f39c12'  # Orange
    },
    CycleRegime.TROUGH: {
        'description': 'Contraction, depressed valuations',
        'pe_multiple_range': (6, 10),
        'pe_multiple_mid': 8,
        'risk_level': 'Very High',
        'color': '#e74c3c'  # Red
    }
}


class CycleRegimeDetector:
    """
    Detects cycle position using technical indicators.

    Uses a combination of:
    - Price vs moving averages (MA50, MA200)
    - Momentum (90-day returns)
    - Momentum acceleration (change in momentum)
    - Relative strength (position in 52-week range)
    """

    def __init__(
        self,
        ma_short: int = 50,
        ma_long: int = 200,
        momentum_window: int = 90
    ):
        """
        Args:
            ma_short: Short-term moving average period
            ma_long: Long-term moving average period
            momentum_window: Window for momentum calculation
        """
        self.ma_short = ma_short
        self.ma_long = ma_long
        self.momentum_window = momentum_window

    def compute_indicators(self, price_series: pd.Series) -> Dict:
        """
        Compute all technical indicators for regime detection.

        Args:
            price_series: Series of historical prices

        Returns:
            Dictionary of indicator values
        """
        price = price_series.dropna()

        # Moving averages
        ma_short = price.rolling(self.ma_short).mean()
        ma_long = price.rolling(self.ma_long).mean()

        # Current values
        current_price = price.iloc[-1]
        current_ma_short = ma_short.iloc[-1]
        current_ma_long = ma_long.iloc[-1]

        # Momentum (90-day return)
        momentum = price.pct_change(self.momentum_window).iloc[-1]

        # Momentum acceleration (30-day change in momentum)
        momentum_30d = price.pct_change(30)
        momentum_accel = (momentum_30d.iloc[-1] - momentum_30d.iloc[-31]) \
            if len(momentum_30d) > 31 else 0

        # Relative strength (position in 52-week range)
        rolling_high = price.rolling(252).max().iloc[-1]
        rolling_low = price.rolling(252).min().iloc[-1]
        relative_strength = (current_price - rolling_low) / (rolling_high - rolling_low) \
            if rolling_high != rolling_low else 0.5

        # MA crossover signal
        ma_cross_bullish = current_ma_short > current_ma_long

        # Price position relative to MAs
        price_above_ma_short = current_price > current_ma_short
        price_above_ma_long = current_price > current_ma_long
        ma_short_above_ma_long = current_ma_short > current_ma_long

        return {
            'current_price': current_price,
            'ma_short': current_ma_short,
            'ma_long': current_ma_long,
            'momentum': momentum,
            'momentum_accel': momentum_accel,
            'relative_strength': relative_strength,
            'price_above_ma_short': price_above_ma_short,
            'price_above_ma_long': price_above_ma_long,
            'ma_short_above_ma_long': ma_short_above_ma_long,
            'ma_cross_bullish': ma_cross_bullish
        }

    def detect_regime(self, price_series: pd.Series) -> Tuple[CycleRegime, Dict]:
        """
        Detect the current cycle regime.

        Args:
            price_series: Series of historical prices

        Returns:
            Tuple of (regime, indicators dict)
        """
        indicators = self.compute_indicators(price_series)

        # Extract key signals
        price_above_short = indicators['price_above_ma_short']
        price_above_long = indicators['price_above_ma_long']
        ma_bullish = indicators['ma_short_above_ma_long']
        momentum = indicators['momentum']
        momentum_accel = indicators['momentum_accel']
        rel_strength = indicators['relative_strength']

        # Regime detection logic
        if not price_above_long and momentum < 0:
            # Price below MA200 and negative momentum = Trough
            regime = CycleRegime.TROUGH

        elif price_above_short and price_above_long and momentum > 0.10 and momentum_accel > 0:
            # Strong uptrend with accelerating momentum = Early Cycle
            regime = CycleRegime.EARLY

        elif price_above_short and price_above_long and momentum > 0 and momentum_accel <= 0:
            # Uptrend but momentum decelerating = Late Cycle
            regime = CycleRegime.LATE

        elif price_above_short and ma_bullish and 0 <= momentum <= 0.10:
            # Steady trend with moderate momentum = Mid Cycle
            regime = CycleRegime.MID

        elif price_above_short and not price_above_long:
            # Transitional - price recovering but below MA200
            if momentum > 0:
                regime = CycleRegime.EARLY
            else:
                regime = CycleRegime.TROUGH

        else:
            # Default to Mid Cycle if signals are mixed
            regime = CycleRegime.MID

        return regime, indicators

    def get_regime_multiple(self, regime: CycleRegime) -> float:
        """
        Get the appropriate PE multiple for a regime.

        Args:
            regime: The detected cycle regime

        Returns:
            Mid-point PE multiple for the regime
        """
        return REGIME_CONFIG[regime]['pe_multiple_mid']

    def get_regime_range(self, regime: CycleRegime) -> Tuple[float, float]:
        """
        Get the PE multiple range for a regime.

        Returns:
            Tuple of (low, high) PE multiples
        """
        return REGIME_CONFIG[regime]['pe_multiple_range']

    def get_regime_info(self, regime: CycleRegime) -> Dict:
        """
        Get full regime configuration.

        Returns:
            Dictionary with regime details
        """
        config = REGIME_CONFIG[regime].copy()
        config['regime'] = regime.value
        return config

    def compute_regime_score(self, indicators: Dict) -> float:
        """
        Compute a numerical score representing cycle position.

        Score ranges from 0 (deep trough) to 100 (peak late cycle).

        Returns:
            Score from 0-100
        """
        # Components
        momentum_score = min(max((indicators['momentum'] + 0.3) / 0.6, 0), 1) * 30
        ma_score = (
            (20 if indicators['price_above_ma_short'] else 0) +
            (20 if indicators['price_above_ma_long'] else 0)
        )
        rs_score = indicators['relative_strength'] * 30

        total_score = momentum_score + ma_score + rs_score

        return min(max(total_score, 0), 100)


def detect_sector_regime(prices: pd.DataFrame) -> Dict[str, Tuple[CycleRegime, Dict]]:
    """
    Detect regime for all stocks in a sector.

    Args:
        prices: DataFrame with tickers as columns

    Returns:
        Dictionary mapping ticker to (regime, indicators)
    """
    detector = CycleRegimeDetector()
    results = {}

    for ticker in prices.columns:
        regime, indicators = detector.detect_regime(prices[ticker])
        results[ticker] = {
            'regime': regime,
            'regime_name': regime.value,
            'indicators': indicators,
            'config': REGIME_CONFIG[regime]
        }

    return results


def get_sector_regime_summary(prices: pd.DataFrame) -> Dict:
    """
    Get aggregate regime analysis for the sector.

    Returns:
        Dictionary with sector-level regime assessment
    """
    results = detect_sector_regime(prices)

    # Count regimes
    regime_counts = {}
    for ticker, data in results.items():
        regime = data['regime_name']
        regime_counts[regime] = regime_counts.get(regime, 0) + 1

    # Determine dominant regime
    dominant_regime = max(regime_counts, key=regime_counts.get)

    # Average momentum across sector
    avg_momentum = np.mean([
        data['indicators']['momentum']
        for data in results.values()
    ])

    return {
        'dominant_regime': dominant_regime,
        'regime_distribution': regime_counts,
        'average_momentum': avg_momentum,
        'individual_regimes': results
    }
