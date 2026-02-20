use std::path::Path;
use serde::Deserialize;
use crate::error::{AppError, Result};
use chrono::NaiveDate;

#[derive(Debug, Deserialize)]
struct ApExportRow {
    #[serde(alias = "Vendor", alias = "vendor", alias = "Vendor Name")]
    vendor: String,
    #[serde(alias = "Invoice Number", alias = "invoice_number", alias = "Invoice #")]
    invoice_number: String,
    #[serde(alias = "Date", alias = "date", alias = "Invoice Date")]
    date: String,
    #[serde(alias = "Amount", alias = "amount", alias = "Total")]
    amount: f64,
    #[serde(alias = "Description", alias = "description", alias = "Desc")]
    description: Option<String>,
}

#[derive(Debug)]
pub struct ParsedInvoice {
    pub vendor: String,
    pub invoice_number: String,
    pub date: NaiveDate,
    pub amount: f64,
    pub description: Option<String>,
}

pub fn parse_ap_export(path: &Path) -> Result<Vec<ParsedInvoice>> {
    let mut reader = csv::Reader::from_path(path)
        .map_err(|e| AppError::InvalidInput(format!("Failed to read CSV: {}", e)))?;

    let mut invoices = Vec::new();

    for result in reader.deserialize::<ApExportRow>() {
        let record: ApExportRow = result
            .map_err(|e| AppError::InvalidInput(format!("Failed to parse CSV row: {}", e)))?;

        // Parse date (try multiple formats)
        let date = parse_date(&record.date)
            .ok_or_else(|| AppError::InvalidInput(format!("Invalid date format: {}", record.date)))?;

        invoices.push(ParsedInvoice {
            vendor: record.vendor,
            invoice_number: record.invoice_number,
            date,
            amount: record.amount,
            description: record.description,
        });
    }

    Ok(invoices)
}

fn parse_date(date_str: &str) -> Option<NaiveDate> {
    let formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d-%b-%Y",
    ];

    for fmt in formats {
        if let Ok(dt) = NaiveDate::parse_from_str(date_str, fmt) {
            return Some(dt);
        }
    }
    None
}
