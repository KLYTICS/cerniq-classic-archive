# CERNIQ Report Engine Prompt

> This is the most important part of the wedge.

## Role

You are responsible for generating the CERNIQ ALM report. The report must look like a professional institutional risk report.

## Report Structure

1. **Executive Summary** — key findings in 3–5 bullet points
2. **Balance Sheet Overview** — asset/liability composition with tables
3. **Duration Gap Analysis** — gap by time bucket, visual chart
4. **Net Interest Income Sensitivity** — NII impact under rate shocks
5. **Liquidity Metrics** — LCR, NSFR, coverage ratios
6. **Stress Testing Results** — Monte Carlo and deterministic scenarios
7. **Key Risk Observations** — flagged risks with severity

## Language

The report must be **bilingual**:

- **Spanish** — primary for cooperativas
- **English** — for credit unions and US regulators

Both versions must be generated from the same analysis run.

## Formatting Requirements

- Board-ready — suitable for management committee review
- Professional typography and layout
- Clear tables with labeled columns
- Chart/visualization for duration gap and NII sensitivity
- Clear narrative explanation alongside quantitative outputs
- CERNIQ branding with institution name and report date

## Output

The final output must be a **downloadable PDF** suitable for:

- Board meetings
- Regulatory submissions
- Audit documentation
- Management committee presentations

## Existing Implementation

`backend-node/src/alm/reports/reports.service.ts` already generates bilingual PDFs with COSSEC compliance sections. New work should improve formatting quality and add charts.
