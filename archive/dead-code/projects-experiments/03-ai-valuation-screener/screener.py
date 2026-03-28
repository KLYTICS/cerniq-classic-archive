#!/usr/bin/env python3
"""
Semiconductor Valuation Screener CLI

Command-line interface for screening semiconductor stocks.

Usage:
    python screener.py                     # Run with defaults
    python screener.py --min-score 70      # Filter by minimum score
    python screener.py --tickers NVDA AMD  # Custom tickers
    python screener.py --export results.csv # Export to CSV
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from data_pipeline import SemiconductorDataPipeline
from valuation_engine import screen_universe


def main():
    parser = argparse.ArgumentParser(
        description='AI Semiconductor Valuation Screener',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python screener.py                          # Default semiconductor equipment universe
  python screener.py --min-score 70           # Only show high-scoring opportunities
  python screener.py --tickers NVDA AMD TSM   # Custom stock universe
  python screener.py --lookback 3             # Use 3 years of history
  python screener.py --export results.csv     # Save results to file
        """
    )

    parser.add_argument(
        '--tickers', '-t',
        nargs='+',
        default=['LRCX', 'AMAT', 'KLAC', 'ASML', 'TER'],
        help='Stock tickers to analyze (default: semiconductor equipment)'
    )

    parser.add_argument(
        '--min-score', '-s',
        type=float,
        default=0,
        help='Minimum composite score threshold (0-100)'
    )

    parser.add_argument(
        '--lookback', '-l',
        type=int,
        default=5,
        help='Years of historical data to use (default: 5)'
    )

    parser.add_argument(
        '--export', '-e',
        type=str,
        help='Export results to CSV file'
    )

    parser.add_argument(
        '--json',
        action='store_true',
        help='Output as JSON instead of table'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed analysis'
    )

    args = parser.parse_args()

    # Header
    print("\n" + "=" * 60)
    print("   AI Semiconductor Valuation Screener")
    print("=" * 60 + "\n")

    # Load data
    print(f"Loading data for: {', '.join(args.tickers)}")
    print(f"Lookback period: {args.lookback} years")
    print()

    try:
        pipeline = SemiconductorDataPipeline(
            tickers=args.tickers,
            lookback_years=args.lookback
        )
        pipeline.fetch_prices()
        pipeline.fetch_fundamentals()

    except Exception as e:
        print(f"Error loading data: {e}")
        sys.exit(1)

    # Run screener
    print("Running valuation analysis...")
    print()

    try:
        results = screen_universe(
            pipeline.prices,
            pipeline.fundamentals,
            min_score=args.min_score
        )
    except Exception as e:
        print(f"Error in analysis: {e}")
        sys.exit(1)

    if len(results) == 0:
        print("No stocks match the criteria.")
        sys.exit(0)

    # Output results
    if args.json:
        print(results.to_json(orient='records', indent=2))
    else:
        # Print header
        print("-" * 80)
        print(f"{'Rank':<5} {'Ticker':<8} {'Score':<8} {'Signal':<8} "
              f"{'Price':>10} {'Fair Val':>10} {'Upside':>8} {'Regime':<12}")
        print("-" * 80)

        # Print each row
        for _, row in results.iterrows():
            signal = row['Signal']
            signal_color = {
                'Buy': '\033[92m',   # Green
                'Sell': '\033[91m',  # Red
                'Hold': '\033[94m',  # Blue
                'Watch': '\033[93m'  # Yellow
            }.get(signal, '')
            reset = '\033[0m'

            print(f"{row['Rank']:<5} {row['Ticker']:<8} {row['Score']:<8.1f} "
                  f"{signal_color}{signal:<8}{reset} "
                  f"${row['Price']:>9.2f} ${row['Fair Value']:>9.2f} "
                  f"{row['Upside %']:>7.1f}% {row['Regime']:<12}")

        print("-" * 80)

        # Summary
        print(f"\nTotal: {len(results)} stocks analyzed")
        print(f"Average Score: {results['Score'].mean():.1f}")
        print(f"Buy Signals: {len(results[results['Signal'] == 'Buy'])}")
        print(f"Average Upside: {results['Upside %'].mean():.1f}%")

    # Verbose output
    if args.verbose and not args.json:
        print("\n" + "=" * 60)
        print("   Detailed Analysis - Top Opportunities")
        print("=" * 60)

        for _, row in results.head(3).iterrows():
            ticker = row['Ticker']
            print(f"\n{ticker}")
            print("-" * 40)
            print(f"  Score:      {row['Score']:.1f}")
            print(f"  Signal:     {row['Signal']}")
            print(f"  Price:      ${row['Price']:.2f}")
            print(f"  Fair Value: ${row['Fair Value']:.2f}")
            print(f"  Upside:     {row['Upside %']:.1f}%")
            print(f"  Regime:     {row['Regime']}")
            print(f"  Risk:       {row['Risk']}")

            # Add fundamentals if available
            if ticker in pipeline.fundamentals.index:
                fund = pipeline.fundamentals.loc[ticker]
                if fund.get('pe_ratio'):
                    print(f"  P/E:        {fund['pe_ratio']:.1f}")
                if fund.get('operating_margins'):
                    print(f"  Op Margin:  {fund['operating_margins']*100:.1f}%")

    # Export if requested
    if args.export:
        results.to_csv(args.export, index=False)
        print(f"\nResults exported to: {args.export}")

    print()


if __name__ == "__main__":
    main()
