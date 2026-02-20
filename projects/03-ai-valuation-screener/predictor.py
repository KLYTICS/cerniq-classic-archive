"""
Quantitative Prediction Models

Machine learning and statistical models for return prediction.
Uses technical indicators, momentum factors, and regime features.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import warnings
warnings.filterwarnings('ignore')


@dataclass
class PredictionResult:
    """Container for prediction results."""
    ticker: str
    signal: str  # 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
    probability: float
    confidence: str  # 'High', 'Medium', 'Low'
    predicted_direction: int  # 1 = up, 0 = down
    features: Dict[str, float]
    model_accuracy: float


class FeatureEngineer:
    """
    Generate predictive features from price data.
    """

    @staticmethod
    def compute_features(prices: pd.Series) -> pd.DataFrame:
        """
        Compute all features for a single stock.

        Args:
            prices: Price series

        Returns:
            DataFrame with features
        """
        df = pd.DataFrame({'price': prices})

        # Returns
        df['return_1d'] = df['price'].pct_change(1)
        df['return_5d'] = df['price'].pct_change(5)
        df['return_10d'] = df['price'].pct_change(10)
        df['return_20d'] = df['price'].pct_change(20)
        df['return_60d'] = df['price'].pct_change(60)

        # Moving averages
        df['ma_10'] = df['price'].rolling(10).mean()
        df['ma_20'] = df['price'].rolling(20).mean()
        df['ma_50'] = df['price'].rolling(50).mean()
        df['ma_200'] = df['price'].rolling(200).mean()

        # MA crossover signals
        df['ma_10_20_cross'] = (df['ma_10'] > df['ma_20']).astype(int)
        df['ma_50_200_cross'] = (df['ma_50'] > df['ma_200']).astype(int)

        # Distance from MAs
        df['dist_ma_10'] = (df['price'] - df['ma_10']) / df['ma_10']
        df['dist_ma_20'] = (df['price'] - df['ma_20']) / df['ma_20']
        df['dist_ma_50'] = (df['price'] - df['ma_50']) / df['ma_50']

        # Volatility
        df['volatility_10'] = df['return_1d'].rolling(10).std()
        df['volatility_20'] = df['return_1d'].rolling(20).std()
        df['volatility_60'] = df['return_1d'].rolling(60).std()

        # Volatility ratio (short vs long term)
        df['vol_ratio'] = df['volatility_10'] / df['volatility_60']

        # RSI (Relative Strength Index)
        delta = df['price'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))

        # RSI zones
        df['rsi_oversold'] = (df['rsi'] < 30).astype(int)
        df['rsi_overbought'] = (df['rsi'] > 70).astype(int)

        # MACD
        exp1 = df['price'].ewm(span=12, adjust=False).mean()
        exp2 = df['price'].ewm(span=26, adjust=False).mean()
        df['macd'] = exp1 - exp2
        df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
        df['macd_hist'] = df['macd'] - df['macd_signal']

        # Bollinger Bands
        df['bb_middle'] = df['price'].rolling(20).mean()
        bb_std = df['price'].rolling(20).std()
        df['bb_upper'] = df['bb_middle'] + 2 * bb_std
        df['bb_lower'] = df['bb_middle'] - 2 * bb_std
        df['bb_position'] = (df['price'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

        # Momentum
        df['momentum_10'] = df['price'] / df['price'].shift(10) - 1
        df['momentum_20'] = df['price'] / df['price'].shift(20) - 1

        # Rate of Change
        df['roc_10'] = (df['price'] - df['price'].shift(10)) / df['price'].shift(10)
        df['roc_20'] = (df['price'] - df['price'].shift(20)) / df['price'].shift(20)

        # Higher highs / Lower lows
        df['highest_20'] = df['price'].rolling(20).max()
        df['lowest_20'] = df['price'].rolling(20).min()
        df['at_high'] = (df['price'] == df['highest_20']).astype(int)
        df['at_low'] = (df['price'] == df['lowest_20']).astype(int)

        # Range position
        df['range_position'] = (df['price'] - df['lowest_20']) / (df['highest_20'] - df['lowest_20'])

        # Trend strength (ADX proxy using volatility)
        df['trend_strength'] = abs(df['return_20d']) / df['volatility_20']

        return df

    @staticmethod
    def get_feature_columns() -> List[str]:
        """Return list of feature column names."""
        return [
            'return_5d', 'return_10d', 'return_20d', 'return_60d',
            'ma_10_20_cross', 'ma_50_200_cross',
            'dist_ma_10', 'dist_ma_20', 'dist_ma_50',
            'volatility_10', 'volatility_20', 'vol_ratio',
            'rsi', 'rsi_oversold', 'rsi_overbought',
            'macd_hist',
            'bb_position',
            'momentum_10', 'momentum_20',
            'roc_10', 'roc_20',
            'range_position', 'trend_strength'
        ]


class ReturnPredictor:
    """
    Predicts future return direction using ensemble methods.
    """

    def __init__(
        self,
        forecast_horizon: int = 20,
        model_type: str = 'ensemble'
    ):
        """
        Args:
            forecast_horizon: Days ahead to predict
            model_type: 'rf', 'gbm', 'logistic', or 'ensemble'
        """
        self.forecast_horizon = forecast_horizon
        self.model_type = model_type
        self.scaler = StandardScaler()
        self.models = {}
        self.feature_importance = None
        self.accuracy = 0.0

        # Initialize models
        self.models['rf'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=20,
            random_state=42,
            n_jobs=-1
        )
        self.models['gbm'] = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.models['logistic'] = LogisticRegression(
            max_iter=1000,
            random_state=42
        )

    def prepare_data(
        self,
        prices: pd.Series,
        threshold: float = 0.0
    ) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Prepare features and target for training.

        Args:
            prices: Price series
            threshold: Return threshold for positive class

        Returns:
            Tuple of (features DataFrame, target Series)
        """
        # Compute features
        features = FeatureEngineer.compute_features(prices)

        # Create target: 1 if forward return > threshold, else 0
        features['forward_return'] = features['price'].pct_change(self.forecast_horizon).shift(-self.forecast_horizon)
        features['target'] = (features['forward_return'] > threshold).astype(int)

        # Select feature columns
        feature_cols = FeatureEngineer.get_feature_columns()

        # Drop rows with NaN
        features = features.dropna()

        X = features[feature_cols]
        y = features['target']

        return X, y

    def train(
        self,
        prices: pd.Series,
        test_size: float = 0.2
    ) -> Dict:
        """
        Train the prediction model.

        Args:
            prices: Historical price series
            test_size: Fraction for testing

        Returns:
            Dictionary with training metrics
        """
        X, y = self.prepare_data(prices)

        if len(X) < 100:
            return {'error': 'Insufficient data for training'}

        # Time series split
        split_idx = int(len(X) * (1 - test_size))
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train models
        metrics = {}

        for name, model in self.models.items():
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_test_scaled)

            metrics[name] = {
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred, zero_division=0),
                'recall': recall_score(y_test, y_pred, zero_division=0),
                'f1': f1_score(y_test, y_pred, zero_division=0)
            }

        # Feature importance from Random Forest
        self.feature_importance = pd.Series(
            self.models['rf'].feature_importances_,
            index=X.columns
        ).sort_values(ascending=False)

        # Best model accuracy
        self.accuracy = max(m['accuracy'] for m in metrics.values())

        return metrics

    def predict(self, prices: pd.Series) -> PredictionResult:
        """
        Generate prediction for current market conditions.

        Args:
            prices: Price series (must include recent data)

        Returns:
            PredictionResult with signal and probability
        """
        # Compute features for latest data point
        features = FeatureEngineer.compute_features(prices)
        feature_cols = FeatureEngineer.get_feature_columns()

        # Get latest row
        latest = features[feature_cols].iloc[-1:].dropna(axis=1)

        if len(latest.columns) < len(feature_cols) * 0.8:
            # Not enough features
            return PredictionResult(
                ticker='',
                signal='Hold',
                probability=0.5,
                confidence='Low',
                predicted_direction=0,
                features={},
                model_accuracy=0.0
            )

        # Pad missing columns with 0
        for col in feature_cols:
            if col not in latest.columns:
                latest[col] = 0

        latest = latest[feature_cols]

        # Scale
        try:
            X_scaled = self.scaler.transform(latest)
        except Exception:
            X_scaled = latest.values

        # Get predictions from all models
        predictions = []
        probabilities = []

        for name, model in self.models.items():
            try:
                pred = model.predict(X_scaled)[0]
                prob = model.predict_proba(X_scaled)[0]
                predictions.append(pred)
                probabilities.append(max(prob))
            except Exception:
                continue

        if not predictions:
            return PredictionResult(
                ticker='',
                signal='Hold',
                probability=0.5,
                confidence='Low',
                predicted_direction=0,
                features=dict(latest.iloc[0]),
                model_accuracy=0.0
            )

        # Ensemble: majority vote
        avg_pred = np.mean(predictions)
        avg_prob = np.mean(probabilities)

        # Generate signal
        if avg_pred > 0.7 and avg_prob > 0.65:
            signal = 'Strong Buy'
        elif avg_pred > 0.5 and avg_prob > 0.55:
            signal = 'Buy'
        elif avg_pred < 0.3 and avg_prob > 0.65:
            signal = 'Strong Sell'
        elif avg_pred < 0.5 and avg_prob > 0.55:
            signal = 'Sell'
        else:
            signal = 'Hold'

        # Confidence
        if avg_prob > 0.70:
            confidence = 'High'
        elif avg_prob > 0.55:
            confidence = 'Medium'
        else:
            confidence = 'Low'

        return PredictionResult(
            ticker='',
            signal=signal,
            probability=avg_prob,
            confidence=confidence,
            predicted_direction=1 if avg_pred > 0.5 else 0,
            features=dict(latest.iloc[0]),
            model_accuracy=self.accuracy
        )


def predict_universe(
    prices: pd.DataFrame,
    forecast_horizon: int = 20
) -> pd.DataFrame:
    """
    Generate predictions for all stocks in universe.

    Args:
        prices: DataFrame of prices (tickers as columns)
        forecast_horizon: Days ahead to predict

    Returns:
        DataFrame with predictions for each ticker
    """
    results = []

    for ticker in prices.columns:
        try:
            price_series = prices[ticker].dropna()

            if len(price_series) < 252:
                continue

            # Train and predict
            predictor = ReturnPredictor(forecast_horizon=forecast_horizon)
            predictor.train(price_series)
            result = predictor.predict(price_series)
            result.ticker = ticker

            results.append({
                'Ticker': ticker,
                'Signal': result.signal,
                'Probability': f"{result.probability:.1%}",
                'Confidence': result.confidence,
                'Direction': 'Up' if result.predicted_direction == 1 else 'Down',
                'Model Accuracy': f"{result.model_accuracy:.1%}"
            })

        except Exception as e:
            continue

    return pd.DataFrame(results)


def get_feature_analysis(prices: pd.Series) -> pd.DataFrame:
    """
    Get current feature values and their interpretation.

    Returns:
        DataFrame with features and interpretations
    """
    features = FeatureEngineer.compute_features(prices)
    latest = features.iloc[-1]

    analysis = []

    # RSI interpretation
    rsi = latest.get('rsi', 50)
    if rsi < 30:
        rsi_interp = 'Oversold - Bullish'
    elif rsi > 70:
        rsi_interp = 'Overbought - Bearish'
    else:
        rsi_interp = 'Neutral'

    analysis.append({
        'Indicator': 'RSI (14)',
        'Value': f"{rsi:.1f}",
        'Signal': rsi_interp
    })

    # MACD
    macd_hist = latest.get('macd_hist', 0)
    macd_signal = 'Bullish' if macd_hist > 0 else 'Bearish'
    analysis.append({
        'Indicator': 'MACD Histogram',
        'Value': f"{macd_hist:.4f}",
        'Signal': macd_signal
    })

    # Moving Average Cross
    ma_cross = latest.get('ma_50_200_cross', 0)
    ma_signal = 'Golden Cross (Bullish)' if ma_cross == 1 else 'Death Cross (Bearish)'
    analysis.append({
        'Indicator': 'MA 50/200 Cross',
        'Value': 'Above' if ma_cross == 1 else 'Below',
        'Signal': ma_signal
    })

    # Bollinger Position
    bb_pos = latest.get('bb_position', 0.5)
    if bb_pos < 0.2:
        bb_signal = 'Near Lower Band - Oversold'
    elif bb_pos > 0.8:
        bb_signal = 'Near Upper Band - Overbought'
    else:
        bb_signal = 'Mid-range'

    analysis.append({
        'Indicator': 'Bollinger Position',
        'Value': f"{bb_pos:.2f}",
        'Signal': bb_signal
    })

    # Momentum
    momentum = latest.get('momentum_20', 0)
    mom_signal = 'Positive' if momentum > 0 else 'Negative'
    analysis.append({
        'Indicator': '20-Day Momentum',
        'Value': f"{momentum*100:.1f}%",
        'Signal': mom_signal
    })

    # Volatility
    vol = latest.get('volatility_20', 0)
    analysis.append({
        'Indicator': '20-Day Volatility',
        'Value': f"{vol*100:.1f}%",
        'Signal': 'High' if vol > 0.02 else 'Normal'
    })

    return pd.DataFrame(analysis)
