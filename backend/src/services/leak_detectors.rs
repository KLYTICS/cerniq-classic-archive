//! Leak Detection Algorithms for SpendCheck
//!
//! This module contains algorithms to detect various types of spend leaks:
//! - Duplicate payments (exact match)
//! - Subscription price drift
//! - Spend spikes (statistical anomalies)
//! - New vendor risks

use sqlx::PgPool;
use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedFinding {
    pub finding_type: String,
    pub severity: i32,
    pub entity_id: Option<String>,
    pub entity_name: String,
    pub title: String,
    pub explanation: String,
    pub evidence: serde_json::Value,
    pub potential_savings: f64,
    pub recommended_action: String,
    pub hash: String,
}

/// Detect exact duplicate payments
pub async fn detect_duplicates(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();

    // Exact duplicates: same vendor, amount, date
    let rows: Vec<(Uuid, Option<Uuid>, Option<String>, Option<f64>, Option<chrono::NaiveDate>, i64)> = 
        sqlx::query_as(
            r#"
            SELECT 
                i1.id,
                i1.vendor_id,
                v.vendor_name,
                i1.amount::float8,
                i1.invoice_date,
                (SELECT COUNT(*) FROM invoices i2 
                 WHERE i2.vendor_id = i1.vendor_id 
                 AND i2.amount = i1.amount 
                 AND i2.invoice_date = i1.invoice_date
                 AND i2.workspace_id = i1.workspace_id) as dup_count
            FROM invoices i1
            JOIN vendors v ON i1.vendor_id = v.id
            WHERE i1.workspace_id = $1
            GROUP BY i1.id, i1.vendor_id, v.vendor_name, i1.amount, i1.invoice_date
            HAVING (SELECT COUNT(*) FROM invoices i2 
                    WHERE i2.vendor_id = i1.vendor_id 
                    AND i2.amount = i1.amount 
                    AND i2.invoice_date = i1.invoice_date
                    AND i2.workspace_id = i1.workspace_id) > 1
            "#
        )
        .bind(workspace_id)
        .fetch_all(db)
        .await?;

    // Dedupe by hash
    let mut seen_hashes = std::collections::HashSet::new();

    for (_, vendor_id, vendor_name, amount, date, dup_count) in rows {
        let hash = calculate_hash(&format!(
            "duplicate_{}_{}_{}", 
            vendor_id.map(|v| v.to_string()).unwrap_or_default(),
            amount.unwrap_or_default(),
            date.map(|d| d.to_string()).unwrap_or_default()
        ));

        if seen_hashes.contains(&hash) {
            continue;
        }
        seen_hashes.insert(hash.clone());

        let vendor_name_str = vendor_name.unwrap_or_default();
        let amount_val = amount.unwrap_or_default();

        findings.push(DetectedFinding {
            finding_type: "duplicate_payment".to_string(),
            severity: 90,
            entity_id: vendor_id.map(|id| id.to_string()),
            entity_name: vendor_name_str.clone(),
            title: "Duplicate Payment Detected".to_string(),
            explanation: format!(
                "Found {} identical payments to {} for {}",
                dup_count, vendor_name_str, format_currency(amount_val)
            ),
            evidence: serde_json::json!({
                "amount": amount_val,
                "date": date,
                "duplicate_count": dup_count
            }),
            potential_savings: amount_val * (dup_count - 1) as f64,
            recommended_action: format!(
                "Contact {} to request refund for duplicate payment",
                vendor_name_str
            ),
            hash,
        });
    }

    Ok(findings)
}

/// Detect subscription price drift (recurring charges with >10% change)
pub async fn detect_subscription_drift(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();

    // Get vendors with 2+ invoices
    let vendors: Vec<(Uuid, Option<String>)> = sqlx::query_as(
        r#"
        SELECT v.id, v.vendor_name
        FROM vendors v
        JOIN invoices i ON v.id = i.vendor_id
        WHERE v.workspace_id = $1
        GROUP BY v.id, v.vendor_name
        HAVING COUNT(i.id) >= 2
        "#
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await?;

    for (vendor_id, vendor_name) in vendors {
        // Get invoices in chronological order
        let invoices: Vec<(Option<f64>, Option<chrono::NaiveDate>)> = sqlx::query_as(
            "SELECT amount::float8, invoice_date FROM invoices WHERE vendor_id = $1 ORDER BY invoice_date ASC"
        )
        .bind(vendor_id)
        .fetch_all(db)
        .await?;

        // Check for price changes > 10%
        for i in 0..invoices.len().saturating_sub(1) {
            let prev_amount = invoices[i].0.unwrap_or(0.0);
            let curr_amount = invoices[i + 1].0.unwrap_or(0.0);

            if prev_amount > 0.0 {
                let change_pct = ((curr_amount - prev_amount) / prev_amount) * 100.0;

                if change_pct.abs() > 10.0 {
                    let hash = calculate_hash(&format!(
                        "subscription_drift_{}_{}",
                        vendor_id,
                        invoices[i + 1].1.map(|d| d.to_string()).unwrap_or_default()
                    ));

                    let vendor_name_str = vendor_name.clone().unwrap_or_default();

                    findings.push(DetectedFinding {
                        finding_type: "subscription_drift".to_string(),
                        severity: if change_pct > 0.0 { 70 } else { 50 },
                        entity_id: Some(vendor_id.to_string()),
                        entity_name: vendor_name_str.clone(),
                        title: "Subscription Price Change Detected".to_string(),
                        explanation: format!(
                            "{} charge changed by {:.1}% ({} → {})",
                            vendor_name_str,
                            change_pct,
                            format_currency(prev_amount),
                            format_currency(curr_amount)
                        ),
                        evidence: serde_json::json!({
                            "previous_amount": prev_amount,
                            "current_amount": curr_amount,
                            "change_percentage": change_pct,
                            "previous_date": invoices[i].1,
                            "current_date": invoices[i + 1].1
                        }),
                        potential_savings: if change_pct > 0.0 { (curr_amount - prev_amount) * 12.0 } else { 0.0 },
                        recommended_action: format!(
                            "Review {} subscription pricing. Contact vendor to negotiate if increase is unjustified",
                            vendor_name_str
                        ),
                        hash,
                    });
                }
            }
        }
    }

    Ok(findings)
}

/// Detect spend spikes (invoices > 2σ from vendor baseline)
pub async fn detect_spend_spikes(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();

    // Get vendors with 3+ invoices and calculate stats
    let vendors: Vec<(Uuid, Option<String>, Option<f64>, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT v.id, v.vendor_name, AVG(i.amount)::float8, STDDEV(i.amount)::float8
        FROM vendors v
        JOIN invoices i ON v.id = i.vendor_id
        WHERE v.workspace_id = $1
        GROUP BY v.id, v.vendor_name
        HAVING COUNT(i.id) >= 3 AND STDDEV(i.amount) > 0
        "#
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await?;

    for (vendor_id, vendor_name, avg_opt, stddev_opt) in vendors {
        let avg = avg_opt.unwrap_or(0.0);
        let stddev = stddev_opt.unwrap_or(0.0);

        if stddev > 0.0 {
            let threshold = avg + (2.0 * stddev);

            // Find outlier invoices
            let outliers: Vec<(Uuid, Option<f64>, Option<String>, Option<chrono::NaiveDate>)> = sqlx::query_as(
                "SELECT id, amount::float8, invoice_number, invoice_date FROM invoices WHERE vendor_id = $1 AND amount > $2"
            )
            .bind(vendor_id)
            .bind(threshold)
            .fetch_all(db)
            .await?;

            for (invoice_id, amount_opt, invoice_number, date) in outliers {
                let amount = amount_opt.unwrap_or(0.0);
                let sigma_deviation = (amount - avg) / stddev;

                let hash = calculate_hash(&format!(
                    "spend_spike_{}_{}", invoice_id, amount
                ));

                let vendor_name_str = vendor_name.clone().unwrap_or_default();

                findings.push(DetectedFinding {
                    finding_type: "spend_spike".to_string(),
                    severity: if sigma_deviation > 3.0 { 85 } else { 70 },
                    entity_id: Some(invoice_id.to_string()),
                    entity_name: vendor_name_str.clone(),
                    title: "Abnormal Spend Detected".to_string(),
                    explanation: format!(
                        "{} invoice {} is {:.1}σ above typical {} baseline",
                        vendor_name_str,
                        invoice_number.as_deref().unwrap_or("N/A"),
                        sigma_deviation,
                        format_currency(avg)
                    ),
                    evidence: serde_json::json!({
                        "invoice_number": invoice_number,
                        "amount": amount,
                        "baseline_average": avg,
                        "baseline_stddev": stddev,
                        "sigma_deviation": sigma_deviation,
                        "date": date
                    }),
                    potential_savings: amount - avg,
                    recommended_action: format!(
                        "Verify {} invoice for legitimacy. Typical spend is {}",
                        vendor_name_str, format_currency(avg)
                    ),
                    hash,
                });
            }
        }
    }

    Ok(findings)
}

/// Detect new vendors with large first payments
pub async fn detect_new_vendor_risks(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();
    let threshold = 10000.0;

    let new_vendors: Vec<(Uuid, String, f64, Option<String>, Option<chrono::NaiveDate>)> = sqlx::query_as(
        r#"
        SELECT v.id, v.vendor_name, i.amount::float8, i.invoice_number, i.invoice_date
        FROM vendors v
        JOIN invoices i ON v.id = i.vendor_id
        WHERE v.workspace_id = $1
        AND v.created_at > NOW() - INTERVAL '30 days'
        AND i.amount > $2
        AND (SELECT COUNT(*) FROM invoices i2 WHERE i2.vendor_id = v.id) = 1
        "#
    )
    .bind(workspace_id)
    .bind(threshold)
    .fetch_all(db)
    .await?;

    for (vendor_id, vendor_name, amount, invoice_number, date) in new_vendors {
        let hash = calculate_hash(&format!(
            "new_vendor_risk_{}_{}", vendor_id, amount
        ));

        findings.push(DetectedFinding {
            finding_type: "vendor_anomaly".to_string(),
            severity: 60,
            entity_id: Some(vendor_id.to_string()),
            entity_name: vendor_name.clone(),
            title: "New Vendor with Large Payment".to_string(),
            explanation: format!(
                "First payment to {} is {} (added recently)",
                vendor_name, format_currency(amount)
            ),
            evidence: serde_json::json!({
                "invoice_number": invoice_number,
                "amount": amount,
                "date": date,
                "is_first_payment": true
            }),
            potential_savings: 0.0,
            recommended_action: format!(
                "Verify {} is a legitimate vendor. Review approval process for large first-time payments",
                vendor_name
            ),
            hash,
        });
    }

    Ok(findings)
}

/// Calculate SHA-256 hash for finding deduplication
pub fn calculate_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn format_currency(amount: f64) -> String {
    format!("${:.2}", amount)
}

/// Detect zombie subscriptions (charges after contract end date)
pub async fn detect_zombie_subscriptions(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();

    // Find invoices paid after contract end date
    let zombies: Vec<(Uuid, String, f64, Option<String>, Option<chrono::NaiveDate>, Option<chrono::NaiveDate>, String)> = sqlx::query_as(
        r#"
        SELECT 
            i.id,
            v.vendor_name,
            i.amount::float8,
            i.invoice_number,
            i.invoice_date,
            c.end_date,
            c.contract_name
        FROM invoices i
        JOIN vendors v ON i.vendor_id = v.id
        JOIN contracts c ON c.vendor_id = v.id
        WHERE i.workspace_id = $1
        AND c.end_date IS NOT NULL
        AND i.invoice_date > c.end_date
        AND c.auto_renew = false
        "#
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await?;

    for (invoice_id, vendor_name, amount, invoice_number, invoice_date, end_date, contract_name) in zombies {
        let hash = calculate_hash(&format!(
            "zombie_sub_{}_{}", invoice_id, vendor_name
        ));

        let days_past = invoice_date
            .and_then(|inv| end_date.map(|end| (inv - end).num_days()))
            .unwrap_or(0);

        findings.push(DetectedFinding {
            finding_type: "zombie_subscription".to_string(),
            severity: 80,
            entity_id: Some(invoice_id.to_string()),
            entity_name: vendor_name.clone(),
            title: "Zombie Subscription Detected".to_string(),
            explanation: format!(
                "{} invoice {} charged {} days after contract '{}' ended",
                vendor_name,
                invoice_number.as_deref().unwrap_or("N/A"),
                days_past,
                contract_name
            ),
            evidence: serde_json::json!({
                "invoice_number": invoice_number,
                "amount": amount,
                "invoice_date": invoice_date,
                "contract_end_date": end_date,
                "contract_name": contract_name,
                "days_past_expiry": days_past
            }),
            potential_savings: amount * 12.0, // Annualized
            recommended_action: format!(
                "Cancel {} subscription immediately. Contract '{}' expired. Request refund for charges after {}",
                vendor_name,
                contract_name,
                end_date.map(|d| d.to_string()).unwrap_or_default()
            ),
            hash,
        });
    }

    Ok(findings)
}

/// Detect potential duplicate vendors (fuzzy name matching)
pub async fn detect_vendor_duplicates(workspace_id: Uuid, db: &PgPool) -> Result<Vec<DetectedFinding>> {
    let mut findings = Vec::new();

    // Get all vendors for workspace
    let vendors: Vec<(Uuid, String, Option<f64>, Option<i32>)> = sqlx::query_as(
        "SELECT id, vendor_name, total_spend::float8, invoice_count FROM vendors WHERE workspace_id = $1"
    )
    .bind(workspace_id)
    .fetch_all(db)
    .await?;

    let mut seen_pairs = std::collections::HashSet::new();

    for i in 0..vendors.len() {
        for j in (i + 1)..vendors.len() {
            let (id1, name1, spend1, count1) = &vendors[i];
            let (id2, name2, spend2, count2) = &vendors[j];

            // Calculate similarity
            let similarity = levenshtein_similarity(name1, name2);

            if similarity > 0.75 && similarity < 1.0 {
                let pair_key = if id1 < id2 {
                    format!("{}_{}", id1, id2)
                } else {
                    format!("{}_{}", id2, id1)
                };

                if seen_pairs.contains(&pair_key) {
                    continue;
                }
                seen_pairs.insert(pair_key);

                let hash = calculate_hash(&format!(
                    "vendor_dup_{}_{}", id1, id2
                ));

                let combined_spend = spend1.unwrap_or(0.0) + spend2.unwrap_or(0.0);
                let combined_count = count1.unwrap_or(0) + count2.unwrap_or(0);

                findings.push(DetectedFinding {
                    finding_type: "vendor_duplicate".to_string(),
                    severity: 50,
                    entity_id: Some(id1.to_string()),
                    entity_name: name1.clone(),
                    title: "Potential Duplicate Vendor".to_string(),
                    explanation: format!(
                        "'{}' and '{}' appear to be the same vendor ({:.0}% match). Combined: {} across {} invoices",
                        name1, name2, similarity * 100.0, format_currency(combined_spend), combined_count
                    ),
                    evidence: serde_json::json!({
                        "vendor_1": { "id": id1, "name": name1, "spend": spend1, "invoices": count1 },
                        "vendor_2": { "id": id2, "name": name2, "spend": spend2, "invoices": count2 },
                        "similarity_score": similarity,
                        "combined_spend": combined_spend,
                        "combined_invoice_count": combined_count
                    }),
                    potential_savings: 0.0, // No direct savings, but improves data quality
                    recommended_action: format!(
                        "Merge '{}' and '{}' in your AP system for cleaner reporting",
                        name1, name2
                    ),
                    hash,
                });
            }
        }
    }

    Ok(findings)
}

/// Calculate Levenshtein distance between two strings
fn levenshtein_distance(s1: &str, s2: &str) -> usize {
    let s1_lower = s1.to_lowercase();
    let s2_lower = s2.to_lowercase();
    
    let s1_chars: Vec<char> = s1_lower.chars().collect();
    let s2_chars: Vec<char> = s2_lower.chars().collect();
    
    let len1 = s1_chars.len();
    let len2 = s2_chars.len();
    
    if len1 == 0 { return len2; }
    if len2 == 0 { return len1; }
    
    let mut matrix = vec![vec![0usize; len2 + 1]; len1 + 1];
    
    for i in 0..=len1 { matrix[i][0] = i; }
    for j in 0..=len2 { matrix[0][j] = j; }
    
    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] { 0 } else { 1 };
            matrix[i][j] = (matrix[i - 1][j] + 1)
                .min(matrix[i][j - 1] + 1)
                .min(matrix[i - 1][j - 1] + cost);
        }
    }
    
    matrix[len1][len2]
}

/// Calculate similarity (0.0 to 1.0) between two strings
fn levenshtein_similarity(s1: &str, s2: &str) -> f64 {
    let max_len = s1.len().max(s2.len());
    if max_len == 0 { return 1.0; }
    let distance = levenshtein_distance(s1, s2);
    1.0 - (distance as f64 / max_len as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_idempotency() {
        let input = "duplicate_12345_5000_2024-01-15";
        let hash1 = calculate_hash(input);
        let hash2 = calculate_hash(input);
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_currency_format() {
        assert_eq!(format_currency(1234.56), "$1234.56");
        assert_eq!(format_currency(1000.0), "$1000.00");
    }

    #[test]
    fn test_levenshtein_distance() {
        assert_eq!(levenshtein_distance("AWS", "AWS"), 0);
        assert_eq!(levenshtein_distance("AWS", "Amazon Web Services"), 16);
        assert_eq!(levenshtein_distance("Slack", "Slack Technologies"), 13);
        assert_eq!(levenshtein_distance("", "test"), 4);
    }

    #[test]
    fn test_levenshtein_similarity() {
        assert_eq!(levenshtein_similarity("AWS", "AWS"), 1.0);
        assert!(levenshtein_similarity("Slack Inc", "Slack Inc.") > 0.9);
        assert!(levenshtein_similarity("AWS", "Amazon Web Services") < 0.5);
    }

    #[test]
    fn test_hash_different_inputs() {
        let hash1 = calculate_hash("input_1");
        let hash2 = calculate_hash("input_2");
        assert_ne!(hash1, hash2);
    }
}
