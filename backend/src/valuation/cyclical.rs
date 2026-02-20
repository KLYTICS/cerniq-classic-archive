//! Cyclical Valuation Engine - Simplified Version
//! 
//! For businesses with cyclical revenue patterns (e.g., semiconductor equipment),
//! this engine detects cycles, normalizes earnings, and calculates fair value.

use anyhow::Result;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tracing::info;

use crate::services::sec_filings::FinancialMetrics;

/// Detected cycle in financial data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cycle {
    pub peak_date: NaiveDate,
    pub trough_date: NaiveDate,
    pub peak_value: f64,
    pub trough_value: f64,
    pub duration_quarters: i32,
}

/// Current position within a cycle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CyclePosition {
    EarlyCycle,    // 0-25% from trough
    MidCycle,      // 25-75%
    LateCycle,     // 75-100% approaching peak
    Peak,          // At or near peak
    Downturn,      // Declining from peak
}

/// Cyclical valuation result
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CyclicalValuation {
    pub id: Option<i32>,
    pub ticker: String,
    pub as_of_date: NaiveDate,
    
    // Cycle Analysis
    pub cycles_detected: i32,
    pub avg_cycle_duration_quarters: f64,
    pub current_cycle_position: String,
    pub quarters_into_cycle: i32,
    
    // Normalized Metrics
    pub mid_cycle_revenue: f64,
    pub mid_cycle_eps: f64,
    pub mid_cycle_margin: f64,
    
    // Current vs Mid-Cycle
    pub revenue_vs_midcycle_pct: f64,
    pub eps_vs_midcycle_pct: f64,
    
    // Valuation
    pub current_price: f64,
    pub mid_cycle_pe: f64,
    pub fair_value_base: f64,
    pub fair_value_low: f64,
    pub fair_value_high: f64,
    pub upside_downside_pct: f64,
    
    // Regime-Specific Multiple
    pub applied_multiple: f64,
    pub cycle_adjustment_factor: f64,
    
    pub created_at: Option<chrono::NaiveDateTime>,
}

pub struct CyclicalValuationEngine {
    db: PgPool,
}

impl CyclicalValuationEngine {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Detect cycles using rolling average smoothing
    /// 
    /// This approach smooths quarterly revenue data with a 4-quarter rolling average
    /// to filter out noise, then detects peaks and troughs using clean comparisons.
    pub fn detect_cycles(data: &[(NaiveDate, f64)]) -> Vec<Cycle> {
        if data.len() < 8 {
            return vec![];
        }

        // Step 1: Apply 3-quarter rolling average to smooth the data
        let smoothed = Self::apply_rolling_average(data, 3);
        
        if smoothed.len() < 5 {
            return vec![];
        }

        // Step 2: Detect peaks and troughs on smoothed data
        let mut peaks: Vec<(NaiveDate, f64, usize)> = Vec::new();
        let mut troughs: Vec<(NaiveDate, f64, usize)> = Vec::new();

        // Use a window of 1 point on each side for peak/trough detection
        let window_size = 1;
        for i in window_size..smoothed.len() - window_size {
            let current = smoothed[i].1;
            
            // Strict peak: higher than ALL neighbors
            let is_peak = smoothed[i - window_size..i].iter().all(|&(_, v)| current > v)
                && smoothed[i + 1..=i + window_size].iter().all(|&(_, v)| current > v);
            
            // Strict trough: lower than ALL neighbors  
            let is_trough = smoothed[i - window_size..i].iter().all(|&(_, v)| current < v)
                && smoothed[i + 1..=i + window_size].iter().all(|&(_, v)| current < v);
            
            if is_peak {
                peaks.push((smoothed[i].0, current, i));
            }
            if is_trough {
                troughs.push((smoothed[i].0, current, i));
            }
        }

        // Step 3: Match peaks and troughs to form cycles (including partial cycles)
        let mut cycles = Vec::new();
        
        // Strategy: Create cycles from any peak-trough pair
        // This handles incomplete data where we might not have full trough-peak-trough patterns
        for peak in &peaks {
            // Find the nearest trough AFTER this peak
            if let Some(trough) = troughs.iter().find(|t| t.2 > peak.2) {
                let duration_days = (trough.0 - peak.0).num_days();
                cycles.push(Cycle {
                    peak_date: peak.0,
                    trough_date: trough.0,
                    peak_value: peak.1,
                    trough_value: trough.1,
                    duration_quarters: (duration_days / 90) as i32,
                });
            }
        }
        
        // Also check for trough-to-peak patterns (ascending part of cycle)
        for trough in &troughs {
            // Find nearest peak AFTER this trough (if we don't already have a cycle)
            if let Some(peak) = peaks.iter().find(|p| p.2 > trough.2) {
                // Check if we already created this cycle from the peak side
                let already_exists = cycles.iter().any(|c| c.peak_date == peak.0 && c.trough_date == trough.0);
                if !already_exists {
                    let duration_days = (peak.0 - trough.0).num_days();
                    cycles.push(Cycle {
                        peak_date: peak.0,
                        trough_date: trough.0,
                        peak_value: peak.1,
                        trough_value: trough.1,
                        duration_quarters: (duration_days / 90) as i32,
                    });
                }
            }
        }

        cycles
    }

    /// Apply rolling average to smooth time series data
    fn apply_rolling_average(data: &[(NaiveDate, f64)], window: usize) -> Vec<(NaiveDate, f64)> {
        if data.len() < window {
            return data.to_vec();
        }

        let mut smoothed = Vec::new();
        
        for i in 0..=data.len() - window {
            let sum: f64 = data[i..i + window].iter().map(|(_, v)| v).sum();
            let avg = sum / window as f64;
            // Use the date of the middle point in the window
            let mid_idx = i + window / 2;
            smoothed.push((data[mid_idx].0, avg));
        }

        smoothed
    }

    /// Calculate mid-cycle normalized value
    pub fn calculate_midcycle_value(cycles: &[Cycle]) -> f64 {
        if cycles.is_empty() {
            return 0.0;
        }

        let mut values = Vec::new();
        for cycle in cycles {
            values.push(cycle.peak_value);
            values.push(cycle.trough_value);
        }

        values.iter().sum::<f64>() / values.len() as f64
    }

    /// Determine current position in cycle
    pub fn determine_cycle_position(
        current_value: f64,
        mid_cycle_value: f64,
        recent_trend: &[f64],
    ) -> CyclePosition {
        let vs_midcycle = (current_value - mid_cycle_value) / mid_cycle_value;

        let is_declining = if recent_trend.len() >= 3 {
            recent_trend[recent_trend.len() - 1] < recent_trend[recent_trend.len() - 3]
        } else {
            false
        };

        match vs_midcycle {
            v if v > 0.25 && is_declining => CyclePosition::Peak,
            v if v > 0.25 => CyclePosition::LateCycle,
            v if v > -0.15 => CyclePosition::MidCycle,
            v if v > -0.35 => CyclePosition::EarlyCycle,
            _ if is_declining => CyclePosition::Downturn,
            _ => CyclePosition::EarlyCycle,
        }
    }

    /// Get regime-specific valuation multiple
    pub fn get_cycle_multiple(position: &CyclePosition, base_multiple: f64) -> f64 {
        let adjustment = match position {
            CyclePosition::EarlyCycle => 1.15,
            CyclePosition::MidCycle => 1.0,
            CyclePosition::LateCycle => 0.90,
            CyclePosition::Peak => 0.75,
            CyclePosition::Downturn => 0.85,
        };

        base_multiple * adjustment
    }

    /// Perform cyclical valuation analysis
    pub async fn value_ticker(&self, ticker: &str, current_price: f64) -> Result<CyclicalValuation> {
        info!("Running cyclical valuation for {}", ticker);

        let revenue_history = sqlx::query_as::<_, FinancialMetrics>(
            "SELECT * FROM financial_metrics WHERE ticker = $1 ORDER BY period_end ASC LIMIT 40",
        )
        .bind(ticker)
        .fetch_all(&self.db)
        .await?;

        if revenue_history.len() < 8 {
            anyhow::bail!(
                "Insufficient quarterly revenue data for {}. Found {} quarters, need 8+ for cycle detection. \
                Try a different ticker or we'll fetch fresh data soon!",
                ticker,
                revenue_history.len()
            );
        }

        let revenue_series: Vec<(NaiveDate, f64)> = revenue_history
            .iter()
            .filter_map(|m| m.revenue.map(|r| (m.period_end, r)))
            .collect();

        let cycles = Self::detect_cycles(&revenue_series);

        if cycles.is_empty() {
            anyhow::bail!("No cycles detected - may not be cyclical business");
        }

        let mid_cycle_revenue = Self::calculate_midcycle_value(&cycles);

        let margins: Vec<f64> = revenue_history
            .iter()
            .filter_map(|m| {
                if let (Some(ni), Some(rev)) = (m.net_income, m.revenue) {
                    Some((ni / rev) * 100.0)
                } else {
                    None
                }
            })
            .collect();

        let mid_cycle_margin = if !margins.is_empty() {
            margins.iter().sum::<f64>() / margins.len() as f64
        } else {
            15.0
        };

        let mid_cycle_earnings = mid_cycle_revenue * (mid_cycle_margin / 100.0);
        let shares_outstanding = 250_000_000.0; // TODO: Extract from data
        let mid_cycle_eps = mid_cycle_earnings / shares_outstanding;

        let latest = revenue_history.last().unwrap();
        let current_revenue = latest.revenue.unwrap_or(0.0);

        let recent_revenues: Vec<f64> = revenue_history
            .iter()
            .rev()
            .take(4)
            .filter_map(|m| m.revenue)
            .collect();

        let cycle_position = Self::determine_cycle_position(
            current_revenue,
            mid_cycle_revenue,
            &recent_revenues,
        );

        let avg_duration = if !cycles.is_empty() {
            cycles.iter().map(|c| c.duration_quarters as f64).sum::<f64>() / cycles.len() as f64
        } else {
            12.0
        };

        let base_pe_multiple = 20.0;
        let adjusted_multiple = Self::get_cycle_multiple(&cycle_position, base_pe_multiple);

        let fair_value_base = mid_cycle_eps * adjusted_multiple;
        let fair_value_low = fair_value_base * 0.85;
        let fair_value_high = fair_value_base * 1.15;

        let upside_downside = ((fair_value_base - current_price) / current_price) * 100.0;
        let revenue_vs_midcycle = ((current_revenue - mid_cycle_revenue) / mid_cycle_revenue) * 100.0;

        let today = chrono::Utc::now().naive_utc().date();

        Ok(CyclicalValuation {
            id: None,
            ticker: ticker.to_uppercase(),
            as_of_date: today,
            cycles_detected: cycles.len() as i32,
            avg_cycle_duration_quarters: avg_duration,
            current_cycle_position: format!("{:?}", cycle_position),
            quarters_into_cycle: 0,
            mid_cycle_revenue,
            mid_cycle_eps,
            mid_cycle_margin,
            revenue_vs_midcycle_pct: revenue_vs_midcycle,
            eps_vs_midcycle_pct: revenue_vs_midcycle,
            current_price,
            mid_cycle_pe: adjusted_multiple,
            fair_value_base,
            fair_value_low,
            fair_value_high,
            upside_downside_pct: upside_downside,
            applied_multiple: adjusted_multiple,
            cycle_adjustment_factor: adjusted_multiple / base_pe_multiple,
            created_at: None,
        })
    }

    /// Store valuation result
    pub async fn store_valuation(&self, valuation: &CyclicalValuation) -> Result<i32> {
        let id = sqlx::query_scalar::<_, i32>(
            r#"
            INSERT INTO cyclical_valuations (
                ticker, as_of_date, cycles_detected, avg_cycle_duration_quarters,
                current_cycle_position, quarters_into_cycle,
                mid_cycle_revenue, mid_cycle_eps, mid_cycle_margin,
                revenue_vs_midcycle_pct, eps_vs_midcycle_pct,
                current_price, mid_cycle_pe, fair_value_base,
                fair_value_low, fair_value_high, upside_downside_pct,
                applied_multiple, cycle_adjustment_factor
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19
            )
            ON CONFLICT (ticker, as_of_date) DO UPDATE SET
                fair_value_base = EXCLUDED.fair_value_base,
                upside_downside_pct = EXCLUDED.upside_downside_pct
            RETURNING id
            "#,
        )
        .bind(&valuation.ticker)
        .bind(valuation.as_of_date)
        .bind(valuation.cycles_detected)
        .bind(valuation.avg_cycle_duration_quarters)
        .bind(&valuation.current_cycle_position)
        .bind(valuation.quarters_into_cycle)
        .bind(valuation.mid_cycle_revenue)
        .bind(valuation.mid_cycle_eps)
        .bind(valuation.mid_cycle_margin)
        .bind(valuation.revenue_vs_midcycle_pct)
        .bind(valuation.eps_vs_midcycle_pct)
        .bind(valuation.current_price)
        .bind(valuation.mid_cycle_pe)
        .bind(valuation.fair_value_base)
        .bind(valuation.fair_value_low)
        .bind(valuation.fair_value_high)
        .bind(valuation.upside_downside_pct)
        .bind(valuation.applied_multiple)
        .bind(valuation.cycle_adjustment_factor)
        .fetch_one(&self.db)
        .await?;

        Ok(id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cycle_detection() {
        // Simulate cyclical revenue with clear peaks and troughs
        let data = vec![
            (NaiveDate::from_ymd_opt(2020, 3, 31).unwrap(), 800.0),
            (NaiveDate::from_ymd_opt(2020, 6, 30).unwrap(), 1000.0),
            (NaiveDate::from_ymd_opt(2020, 9, 30).unwrap(), 1200.0),
            (NaiveDate::from_ymd_opt(2020, 12, 31).unwrap(), 1500.0), // Peak 1
            (NaiveDate::from_ymd_opt(2021, 3, 31).unwrap(), 1200.0),
            (NaiveDate::from_ymd_opt(2021, 6, 30).unwrap(), 900.0),
            (NaiveDate::from_ymd_opt(2021, 9, 30).unwrap(), 700.0),   // Trough
            (NaiveDate::from_ymd_opt(2021, 12, 31).unwrap(), 1000.0),
            (NaiveDate::from_ymd_opt(2022, 3, 31).unwrap(), 1300.0),
            (NaiveDate::from_ymd_opt(2022, 6, 30).unwrap(), 1600.0),  // Peak 2
            (NaiveDate::from_ymd_opt(2022, 9, 30).unwrap(), 1300.0),
            (NaiveDate::from_ymd_opt(2022, 12, 31).unwrap(), 950.0),
            (NaiveDate::from_ymd_opt(2023, 3, 31).unwrap(), 750.0),   // Trough 2
        ];

        let cycles = CyclicalValuationEngine::detect_cycles(&data);
        
        println!("Detected {} cycles", cycles.len());
        for (i, cycle) in cycles.iter().enumerate() {
            println!("Cycle {}: Peak={:.0} at {:?}, Trough={:.0} at {:?}, Duration={} quarters", 
                i+1, cycle.peak_value, cycle.peak_date, 
                cycle.trough_value, cycle.trough_date, 
                cycle.duration_quarters);
        }
        
        assert!(!cycles.is_empty(), "Should detect at least 1 cycle");
        
        if let Some(cycle) = cycles.first() {
            assert!(cycle.peak_value > cycle.trough_value, "Peak should be higher than trough");
            assert!(cycle.duration_quarters > 0, "Cycle should have positive duration");
        }
    }

    #[test]
    fn test_midcycle_calculation() {
        let cycles = vec![
            Cycle {
                peak_date: NaiveDate::from_ymd_opt(2020, 9, 30).unwrap(),
                trough_date: NaiveDate::from_ymd_opt(2020, 3, 31).unwrap(),
                peak_value: 1500.0,
                trough_value: 1000.0,
                duration_quarters: 6,
            },
        ];

        let midcycle = CyclicalValuationEngine::calculate_midcycle_value(&cycles);
        
        assert_eq!(midcycle, 1250.0, "Mid-cycle should be average of peak and trough");
    }
}
