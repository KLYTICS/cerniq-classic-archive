use std::f64::consts::PI;
use statrs::distribution::{Normal, ContinuousCDF};

/// Option type (Call or Put)
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OptionType {
    Call,
    Put,
}

/// Black-Scholes Greeks
#[derive(Debug, Clone, Copy)]
pub struct Greeks {
    pub delta: f64,
    pub gamma: f64,
    pub theta: f64,
    pub vega: f64,
    pub rho: f64,
    pub price: f64,
}

/// High-performance Option Pricing Engine
pub struct OptionEngine;

impl OptionEngine {
    /// Calculate Black-Scholes price and Greeks
    /// 
    /// # Arguments
    /// * `s` - Current underlying price
    /// * `k` - Strike price
    /// * `t` - Time to expiration (in years)
    /// * `r` - Risk-free interest rate (decimal)
    /// * `sigma` - Implied volatility (decimal)
    /// * `option_type` - Call or Put
    pub fn calculate(
        s: f64,
        k: f64,
        t: f64,
        r: f64,
        sigma: f64,
        option_type: OptionType,
    ) -> Greeks {
        if t <= 0.0 {
            // Expired option logic could go here, for now return zeroes/intrinsic
            let price = match option_type {
                OptionType::Call => (s - k).max(0.0),
                OptionType::Put => (k - s).max(0.0),
            };
            return Greeks { delta: 0.0, gamma: 0.0, theta: 0.0, vega: 0.0, rho: 0.0, price };
        }

        let d1 = ((s / k).ln() + (r + 0.5 * sigma.powi(2)) * t) / (sigma * t.sqrt());
        let d2 = d1 - sigma * t.sqrt();

        let normal = Normal::new(0.0, 1.0).unwrap();
        
        // Cumulative distribution function
        let nd1 = normal.cdf(d1);
        let nd2 = normal.cdf(d2);
        
        // Probability density function
        let npd1 = ((-d1.powi(2) / 2.0).exp()) / (2.0 * PI).sqrt();

        let (price, delta, theta, rho) = match option_type {
            OptionType::Call => {
                let price = s * nd1 - k * (-r * t).exp() * nd2;
                let delta = nd1;
                let theta = (-s * npd1 * sigma / (2.0 * t.sqrt()) 
                            - r * k * (-r * t).exp() * nd2);
                let rho = k * t * (-r * t).exp() * nd2;
                (price, delta, theta, rho)
            },
            OptionType::Put => {
                let nd1_neg = normal.cdf(-d1);
                let nd2_neg = normal.cdf(-d2);
                
                let price = k * (-r * t).exp() * nd2_neg - s * nd1_neg;
                let delta = nd1 - 1.0;
                let theta = (-s * npd1 * sigma / (2.0 * t.sqrt()) 
                            + r * k * (-r * t).exp() * nd2_neg);
                let rho = -k * t * (-r * t).exp() * nd2_neg;
                (price, delta, theta, rho)
            }
        };

        let gamma = npd1 / (s * sigma * t.sqrt());
        let vega = s * t.sqrt() * npd1; // Vega is the same for Call and Put

        Greeks {
            delta,
            gamma,
            theta: theta / 365.0, // Annualized theta converted to daily decay usually preferred
            vega: vega / 100.0,   // Standard convention: sensitivity to 1% change in vol
            rho: rho / 100.0,     // Sensitivity to 1% change in rates
            price,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_call_option() {
        // Standard check: Call ITM
        let res = OptionEngine::calculate(100.0, 90.0, 1.0, 0.05, 0.2, OptionType::Call);
        assert!(res.delta > 0.5);
        assert!(res.price > 10.0); // Intrinsic value is 10
    }
}
