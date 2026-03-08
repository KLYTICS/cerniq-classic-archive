//! Mock Valuation Data Service
//! Provides realistic fallback valuation data when external APIs fail

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MockValuation {
    pub ticker: String,
    pub name: String,
    pub sector: String,
    pub current_price: f64,
    pub fair_value: f64,
    pub pe_ratio: f64,
    pub forward_pe: f64,
    pub ps_ratio: f64,
    pub pb_ratio: f64,
    pub peg_ratio: f64,
    pub dividend_yield: f64,
    pub revenue_growth: f64,
    pub earnings_growth: f64,
    pub upside_pct: f64,
    pub rating: String,
    pub cycle_position: String,
}

impl MockValuation {
    fn new(
        ticker: &str,
        name: &str,
        sector: &str,
        price: f64,
        fair_value: f64,
        pe: f64,
        fwd_pe: f64,
        ps: f64,
        pb: f64,
        peg: f64,
        div_yield: f64,
        rev_growth: f64,
        earn_growth: f64,
        cycle: &str,
    ) -> Self {
        let upside = ((fair_value - price) / price) * 100.0;
        let rating = if upside > 20.0 {
            "Strong Buy"
        } else if upside > 10.0 {
            "Buy"
        } else if upside > -10.0 {
            "Hold"
        } else if upside > -20.0 {
            "Sell"
        } else {
            "Strong Sell"
        };

        Self {
            ticker: ticker.to_string(),
            name: name.to_string(),
            sector: sector.to_string(),
            current_price: price,
            fair_value,
            pe_ratio: pe,
            forward_pe: fwd_pe,
            ps_ratio: ps,
            pb_ratio: pb,
            peg_ratio: peg,
            dividend_yield: div_yield,
            revenue_growth: rev_growth,
            earnings_growth: earn_growth,
            upside_pct: upside,
            rating: rating.to_string(),
            cycle_position: cycle.to_string(),
        }
    }
}

static MOCK_VALUATIONS: Lazy<HashMap<String, MockValuation>> = Lazy::new(|| {
    let mut map = HashMap::new();

    // Semiconductors
    map.insert(
        "NVDA".to_string(),
        MockValuation::new(
            "NVDA",
            "NVIDIA Corporation",
            "Semiconductors",
            878.35,
            950.0,
            65.2,
            42.5,
            28.4,
            45.2,
            1.2,
            0.03,
            122.5,
            88.4,
            "Peak",
        ),
    );
    map.insert(
        "AMD".to_string(),
        MockValuation::new(
            "AMD",
            "Advanced Micro Devices",
            "Semiconductors",
            118.45,
            145.0,
            45.8,
            28.3,
            8.2,
            4.1,
            0.9,
            0.0,
            45.2,
            32.1,
            "Growth",
        ),
    );
    map.insert(
        "LRCX".to_string(),
        MockValuation::new(
            "LRCX",
            "Lam Research",
            "Semiconductors",
            78.50,
            92.0,
            22.4,
            18.6,
            6.8,
            9.2,
            1.1,
            1.2,
            18.5,
            22.3,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "AMAT".to_string(),
        MockValuation::new(
            "AMAT",
            "Applied Materials",
            "Semiconductors",
            185.30,
            210.0,
            21.8,
            17.9,
            5.9,
            8.1,
            1.0,
            0.9,
            15.2,
            18.7,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "KLAC".to_string(),
        MockValuation::new(
            "KLAC",
            "KLA Corporation",
            "Semiconductors",
            715.60,
            780.0,
            24.5,
            20.1,
            8.2,
            10.5,
            1.1,
            1.1,
            12.8,
            15.4,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "ASML".to_string(),
        MockValuation::new(
            "ASML",
            "ASML Holding",
            "Semiconductors",
            728.45,
            850.0,
            42.3,
            35.8,
            12.4,
            18.2,
            1.8,
            0.8,
            28.5,
            24.6,
            "Growth",
        ),
    );
    map.insert(
        "INTC".to_string(),
        MockValuation::new(
            "INTC",
            "Intel Corporation",
            "Semiconductors",
            22.45,
            28.0,
            85.2,
            18.5,
            1.8,
            1.2,
            2.5,
            2.8,
            -15.2,
            -8.4,
            "Trough",
        ),
    );
    map.insert(
        "QCOM".to_string(),
        MockValuation::new(
            "QCOM",
            "Qualcomm",
            "Semiconductors",
            168.90,
            195.0,
            18.5,
            14.2,
            5.2,
            7.8,
            0.8,
            2.1,
            8.5,
            12.3,
            "Recovery",
        ),
    );
    map.insert(
        "MU".to_string(),
        MockValuation::new(
            "MU",
            "Micron Technology",
            "Semiconductors",
            98.75,
            120.0,
            15.2,
            8.5,
            3.8,
            2.4,
            0.4,
            0.4,
            45.2,
            180.5,
            "Recovery",
        ),
    );
    map.insert(
        "TSM".to_string(),
        MockValuation::new(
            "TSM",
            "Taiwan Semiconductor",
            "Semiconductors",
            185.20,
            210.0,
            28.4,
            22.5,
            10.2,
            12.8,
            1.5,
            1.4,
            22.5,
            28.4,
            "Growth",
        ),
    );

    // Big Tech
    map.insert(
        "AAPL".to_string(),
        MockValuation::new(
            "AAPL",
            "Apple Inc",
            "Technology",
            227.45,
            245.0,
            32.5,
            28.2,
            8.5,
            42.8,
            3.2,
            0.5,
            2.8,
            8.5,
            "Mature",
        ),
    );
    map.insert(
        "MSFT".to_string(),
        MockValuation::new(
            "MSFT",
            "Microsoft Corporation",
            "Technology",
            415.80,
            480.0,
            35.2,
            30.5,
            12.8,
            12.5,
            2.8,
            0.8,
            15.2,
            18.4,
            "Growth",
        ),
    );
    map.insert(
        "GOOGL".to_string(),
        MockValuation::new(
            "GOOGL",
            "Alphabet Inc",
            "Technology",
            185.25,
            210.0,
            24.5,
            20.8,
            6.2,
            7.8,
            1.2,
            0.0,
            12.5,
            22.8,
            "Growth",
        ),
    );
    map.insert(
        "AMZN".to_string(),
        MockValuation::new(
            "AMZN",
            "Amazon.com",
            "Consumer Cyclical",
            224.90,
            260.0,
            52.8,
            38.5,
            3.2,
            12.5,
            2.5,
            0.0,
            11.2,
            45.2,
            "Growth",
        ),
    );
    map.insert(
        "META".to_string(),
        MockValuation::new(
            "META",
            "Meta Platforms",
            "Technology",
            605.75,
            680.0,
            28.5,
            22.4,
            8.5,
            9.2,
            1.2,
            0.4,
            18.5,
            32.4,
            "Growth",
        ),
    );
    map.insert(
        "TSLA".to_string(),
        MockValuation::new(
            "TSLA",
            "Tesla Inc",
            "Automotive",
            368.20,
            320.0,
            85.2,
            62.5,
            8.2,
            15.8,
            4.5,
            0.0,
            18.2,
            25.4,
            "Peak",
        ),
    );

    // ETFs
    map.insert(
        "SPY".to_string(),
        MockValuation::new(
            "SPY",
            "S&P 500 ETF",
            "ETF",
            594.23,
            620.0,
            22.5,
            20.2,
            2.8,
            4.5,
            1.0,
            1.3,
            8.5,
            12.2,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "QQQ".to_string(),
        MockValuation::new(
            "QQQ",
            "Nasdaq 100 ETF",
            "ETF",
            516.89,
            560.0,
            32.5,
            28.4,
            5.2,
            8.2,
            1.5,
            0.5,
            15.2,
            22.5,
            "Growth",
        ),
    );
    map.insert(
        "DIA".to_string(),
        MockValuation::new(
            "DIA",
            "Dow Jones ETF",
            "ETF",
            428.50,
            450.0,
            18.5,
            16.8,
            2.2,
            3.8,
            0.9,
            1.8,
            5.2,
            8.4,
            "Mature",
        ),
    );
    map.insert(
        "IWM".to_string(),
        MockValuation::new(
            "IWM",
            "Russell 2000 ETF",
            "ETF",
            225.80,
            260.0,
            24.5,
            18.2,
            1.5,
            2.2,
            1.2,
            1.2,
            8.5,
            15.2,
            "Recovery",
        ),
    );

    // Financials
    map.insert(
        "JPM".to_string(),
        MockValuation::new(
            "JPM",
            "JPMorgan Chase",
            "Financial Services",
            245.60,
            275.0,
            12.5,
            11.2,
            3.8,
            1.8,
            0.8,
            2.4,
            12.5,
            15.8,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "BAC".to_string(),
        MockValuation::new(
            "BAC",
            "Bank of America",
            "Financial Services",
            42.85,
            48.0,
            12.8,
            10.5,
            2.8,
            1.2,
            0.9,
            2.8,
            8.5,
            12.2,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "GS".to_string(),
        MockValuation::new(
            "GS",
            "Goldman Sachs",
            "Financial Services",
            565.40,
            620.0,
            15.2,
            12.8,
            2.5,
            1.5,
            0.7,
            2.2,
            18.5,
            22.4,
            "Growth",
        ),
    );

    // Healthcare
    map.insert(
        "JNJ".to_string(),
        MockValuation::new(
            "JNJ",
            "Johnson & Johnson",
            "Healthcare",
            158.90,
            175.0,
            15.8,
            14.2,
            4.2,
            5.8,
            1.2,
            3.2,
            5.2,
            8.5,
            "Mature",
        ),
    );
    map.insert(
        "UNH".to_string(),
        MockValuation::new(
            "UNH",
            "UnitedHealth Group",
            "Healthcare",
            485.20,
            540.0,
            18.5,
            15.8,
            1.2,
            5.2,
            0.9,
            1.4,
            12.5,
            15.8,
            "Growth",
        ),
    );
    map.insert(
        "PFE".to_string(),
        MockValuation::new(
            "PFE",
            "Pfizer Inc",
            "Healthcare",
            26.45,
            32.0,
            12.5,
            10.8,
            2.8,
            1.8,
            0.8,
            5.8,
            -25.2,
            -18.4,
            "Trough",
        ),
    );

    // Energy
    map.insert(
        "XOM".to_string(),
        MockValuation::new(
            "XOM",
            "Exxon Mobil",
            "Energy",
            108.75,
            125.0,
            12.5,
            11.2,
            1.2,
            2.1,
            0.8,
            3.4,
            8.5,
            12.2,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "CVX".to_string(),
        MockValuation::new(
            "CVX",
            "Chevron Corporation",
            "Energy",
            152.40,
            175.0,
            14.2,
            12.5,
            1.5,
            2.4,
            0.9,
            4.2,
            5.2,
            8.5,
            "Mid-Cycle",
        ),
    );

    // Consumer
    map.insert(
        "WMT".to_string(),
        MockValuation::new(
            "WMT",
            "Walmart Inc",
            "Consumer Defensive",
            178.50,
            195.0,
            32.5,
            28.4,
            0.8,
            8.2,
            2.5,
            1.2,
            5.5,
            8.2,
            "Mature",
        ),
    );
    map.insert(
        "COST".to_string(),
        MockValuation::new(
            "COST",
            "Costco Wholesale",
            "Consumer Defensive",
            925.80,
            980.0,
            52.5,
            45.2,
            1.2,
            15.8,
            3.2,
            0.6,
            8.5,
            12.5,
            "Growth",
        ),
    );
    map.insert(
        "HD".to_string(),
        MockValuation::new(
            "HD",
            "Home Depot",
            "Consumer Cyclical",
            385.20,
            420.0,
            24.5,
            21.8,
            2.2,
            85.2,
            1.8,
            2.5,
            2.8,
            8.5,
            "Mature",
        ),
    );
    map.insert(
        "NKE".to_string(),
        MockValuation::new(
            "NKE",
            "Nike Inc",
            "Consumer Cyclical",
            78.45,
            95.0,
            28.5,
            22.4,
            2.5,
            8.2,
            1.5,
            1.5,
            -8.5,
            5.2,
            "Recovery",
        ),
    );
    map.insert(
        "SBUX".to_string(),
        MockValuation::new(
            "SBUX",
            "Starbucks Corporation",
            "Consumer Cyclical",
            98.25,
            115.0,
            24.8,
            20.5,
            2.8,
            0.0,
            1.2,
            2.8,
            5.2,
            12.5,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "MCD".to_string(),
        MockValuation::new(
            "MCD",
            "McDonald's Corporation",
            "Consumer Cyclical",
            295.80,
            320.0,
            25.2,
            22.5,
            8.5,
            0.0,
            1.5,
            2.2,
            8.5,
            12.2,
            "Mature",
        ),
    );

    // Crypto-related
    map.insert(
        "COIN".to_string(),
        MockValuation::new(
            "COIN",
            "Coinbase Global",
            "Financial Services",
            285.40,
            320.0,
            35.2,
            18.5,
            8.5,
            5.2,
            0.0,
            0.0,
            85.2,
            250.4,
            "Peak",
        ),
    );
    map.insert(
        "MSTR".to_string(),
        MockValuation::new(
            "MSTR",
            "MicroStrategy",
            "Technology",
            1850.25,
            1600.0,
            0.0,
            0.0,
            45.2,
            85.2,
            0.0,
            0.0,
            5.2,
            -15.8,
            "Speculative",
        ),
    );

    // Industrial
    map.insert(
        "CAT".to_string(),
        MockValuation::new(
            "CAT",
            "Caterpillar Inc",
            "Industrials",
            385.60,
            420.0,
            18.5,
            15.8,
            2.5,
            8.5,
            1.2,
            1.5,
            8.5,
            12.2,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "BA".to_string(),
        MockValuation::new(
            "BA",
            "Boeing Company",
            "Industrials",
            178.45,
            220.0,
            0.0,
            25.8,
            1.8,
            0.0,
            0.0,
            0.0,
            -5.2,
            0.0,
            "Recovery",
        ),
    );
    map.insert(
        "GE".to_string(),
        MockValuation::new(
            "GE",
            "General Electric",
            "Industrials",
            185.20,
            210.0,
            32.5,
            28.4,
            3.2,
            8.5,
            1.5,
            0.8,
            15.2,
            22.5,
            "Growth",
        ),
    );
    map.insert(
        "HON".to_string(),
        MockValuation::new(
            "HON",
            "Honeywell International",
            "Industrials",
            215.80,
            240.0,
            22.5,
            19.8,
            3.8,
            8.2,
            1.2,
            2.1,
            5.2,
            8.5,
            "Mature",
        ),
    );

    // Communications
    map.insert(
        "DIS".to_string(),
        MockValuation::new(
            "DIS",
            "Walt Disney Company",
            "Communication Services",
            112.45,
            135.0,
            68.5,
            22.5,
            2.1,
            2.2,
            1.5,
            0.8,
            2.5,
            45.2,
            "Recovery",
        ),
    );
    map.insert(
        "NFLX".to_string(),
        MockValuation::new(
            "NFLX",
            "Netflix Inc",
            "Communication Services",
            925.80,
            980.0,
            48.5,
            35.2,
            8.5,
            18.5,
            2.2,
            0.0,
            15.2,
            22.5,
            "Growth",
        ),
    );
    map.insert(
        "T".to_string(),
        MockValuation::new(
            "T",
            "AT&T Inc",
            "Communication Services",
            22.85,
            26.0,
            10.5,
            9.2,
            1.2,
            1.5,
            0.8,
            5.8,
            -2.5,
            15.2,
            "Mature",
        ),
    );
    map.insert(
        "VZ".to_string(),
        MockValuation::new(
            "VZ",
            "Verizon Communications",
            "Communication Services",
            42.15,
            48.0,
            9.8,
            8.5,
            1.5,
            2.2,
            0.7,
            6.5,
            0.5,
            8.2,
            "Mature",
        ),
    );

    // Real Estate
    map.insert(
        "PLD".to_string(),
        MockValuation::new(
            "PLD",
            "Prologis Inc",
            "Real Estate",
            118.45,
            135.0,
            42.5,
            38.2,
            15.2,
            2.8,
            2.5,
            3.2,
            8.5,
            12.5,
            "Mid-Cycle",
        ),
    );
    map.insert(
        "AMT".to_string(),
        MockValuation::new(
            "AMT",
            "American Tower",
            "Real Estate",
            198.75,
            225.0,
            38.5,
            32.5,
            8.5,
            0.0,
            2.2,
            3.5,
            5.2,
            8.5,
            "Growth",
        ),
    );

    // Materials
    map.insert(
        "LIN".to_string(),
        MockValuation::new(
            "LIN",
            "Linde plc",
            "Materials",
            465.80,
            510.0,
            32.5,
            28.4,
            6.8,
            5.2,
            1.8,
            1.2,
            8.5,
            12.2,
            "Growth",
        ),
    );
    map.insert(
        "APD".to_string(),
        MockValuation::new(
            "APD",
            "Air Products",
            "Materials",
            285.40,
            320.0,
            24.5,
            21.2,
            5.2,
            4.8,
            1.5,
            2.5,
            8.5,
            12.5,
            "Mid-Cycle",
        ),
    );

    map
});

/// Get mock valuation for a ticker
pub fn get_mock_valuation(ticker: &str) -> Option<MockValuation> {
    MOCK_VALUATIONS.get(&ticker.to_uppercase()).cloned()
}

/// Get all mock valuations for screener
pub fn get_all_mock_valuations() -> Vec<MockValuation> {
    MOCK_VALUATIONS.values().cloned().collect()
}

/// Filter valuations by criteria
pub fn screen_valuations(
    sector: Option<&str>,
    min_upside: Option<f64>,
    max_pe: Option<f64>,
    rating: Option<&str>,
) -> Vec<MockValuation> {
    MOCK_VALUATIONS
        .values()
        .filter(|v| {
            let sector_match = sector
                .map(|s| v.sector.to_lowercase().contains(&s.to_lowercase()))
                .unwrap_or(true);
            let upside_match = min_upside.map(|u| v.upside_pct >= u).unwrap_or(true);
            let pe_match = max_pe
                .map(|p| v.pe_ratio <= p && v.pe_ratio > 0.0)
                .unwrap_or(true);
            let rating_match = rating
                .map(|r| v.rating.to_lowercase().contains(&r.to_lowercase()))
                .unwrap_or(true);
            sector_match && upside_match && pe_match && rating_match
        })
        .cloned()
        .collect()
}

/// Compare multiple tickers
pub fn compare_valuations(tickers: &[String]) -> Vec<MockValuation> {
    tickers
        .iter()
        .filter_map(|t| get_mock_valuation(t))
        .collect()
}
