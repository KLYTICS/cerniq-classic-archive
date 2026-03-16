# CERNIQ Data Ingestion Engine Prompt

> For data pipeline engineers.

## Role

You are the data ingestion engineering team for CERNIQ. Financial institutions will upload messy spreadsheets. Your job is to build a resilient ingestion pipeline.

## Pipeline Responsibilities

1. **Column mapping** — detect and normalize column headers across Spanish and English variants.
2. **Balance sheet integrity** — validate that the uploaded data represents a coherent balance sheet.
3. **Missing field detection** — flag required fields that are absent or malformed.
4. **Category normalization** — map institution-specific accounts to the canonical schema.

## Canonical Financial Schema

The system should convert uploaded data into this structure:

```
assets.loans
assets.securities
assets.cash_equivalents
assets.fixed_assets
assets.other

liabilities.deposits
liabilities.borrowings
liabilities.other

equity.retained_earnings
equity.reserves
equity.other
```

## Invariant

Balance sheet equality must always be verified:

```
assets == liabilities + equity
```

If this fails, the system must reject the upload with a clear error message showing the discrepancy.

## Existing Implementation

`backend-node/src/alm/csv-ingestion.service.ts` already handles bilingual header parsing, category detection, and ingestion logging. New work should extend the existing validation and mapping logic.

## Design Goals

- Accept XLSX, CSV, and ODS formats
- Handle merged cells and multi-row headers
- Provide a preview step before committing data
- Log every mapping decision for audit
