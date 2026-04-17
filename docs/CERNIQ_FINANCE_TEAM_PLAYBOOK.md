# CERNIQ — FINANCE TEAM ADOPTION PLAYBOOK
### The CFO's, Treasurer's, and Risk Manager's Complete Guide to Deploying Institutional-Grade ALM Reporting

**Version 1.0 | April 2026**
**Classification: Finance Team Internal Use**
**Languages: English / Español**

---

> *"The difference between a community bank that survives a rate cycle and one that doesn't is rarely capital — it's the quality of information in the boardroom. CERNIQ was built to close that gap."*

---

## PREFACE: WHO THIS DOCUMENT IS FOR

This playbook is written for the skeptic. You are a CFO, Treasurer, Risk Manager, or Compliance Officer at a cooperativa, credit union, or community bank. You have seen technology promises come and go. You have inherited Excel models built by someone who left three years ago. You have paid consultants $15,000–$40,000 per year to produce reports that arrive two weeks after you needed them. You have sat through examinations where you scrambled to produce documentation.

This document will not ask you to trust CERNIQ on faith. It will show you exactly how to validate the platform independently, integrate it with your existing systems, satisfy your regulators, and eliminate the most expensive friction in your finance operation.

Every section addresses the concerns of a specific role. Read the sections relevant to you. Forward the others to your colleagues.

---

## SECTION 1: THE CFO'S DECISION FRAMEWORK

### The Three Questions Every CFO Asks

Before any CFO approves a new financial technology vendor, three questions must be answered with precision. Vague marketing language is not acceptable. Here are CERNIQ's answers.

---

**Question 1: "Is it accurate?"**

CERNIQ's calculation engine is built on three architectural decisions that directly determine accuracy:

1. **Decimal arithmetic, not floating point.** Every interest rate, balance, and cash flow is computed using Python's `Decimal` library with 28-digit precision. Floating-point arithmetic — the default in most spreadsheet and programming environments — introduces rounding errors that compound across thousands of calculations. On a $500M balance sheet, floating-point drift in a duration calculation can produce errors of several basis points. CERNIQ eliminates this class of error entirely.

2. **10,000 Monte Carlo paths for NII simulation.** Stochastic income simulation requires a path count large enough to produce stable distribution estimates. Below 5,000 paths, variance in tail percentiles (95th, 99th) remains too high for regulatory confidence. CERNIQ runs 10,000 paths as the default, producing standard errors on the 99th-percentile NII loss estimate below 3 basis points on a typical community institution balance sheet.

3. **Key-rate durations across 11 tenor points.** Parallel shift analysis — the approach used in most Excel ALM models — assumes the entire yield curve moves uniformly. Actual rate environments do not behave this way. The 2022–2023 rate cycle demonstrated that short-end rates can move 500 basis points while long-end rates move 250 basis points. Key-rate duration analysis at the 3-month, 6-month, 1-year, 2-year, 3-year, 5-year, 7-year, 10-year, 15-year, 20-year, and 30-year tenor points captures the actual exposure profile of your balance sheet to realistic curve shapes: parallel, bear-steepener, bull-flattener, and twist scenarios.

**Verification method:** Upload your most recent quarter-end balance sheet. Run CERNIQ's Duration Gap module. Compare the output to your existing model. The delta will be attributable to one of three sources: (a) CERNIQ's precision arithmetic vs. your model's rounding, (b) CERNIQ's key-rate decomposition vs. your model's parallel assumption, or (c) data mapping corrections CERNIQ flags during import. Section 2 of this playbook provides the full parallel-run validation methodology.

---

**Question 2: "Will it pass examination?"**

CERNIQ was designed with examination outcomes as the primary success criterion — not UI elegance, not feature count.

For NCUA-regulated institutions: CERNIQ maps directly to the seven examination areas defined in NCUA Letter 10-CU-03 (Interest Rate Risk Policy and Program Requirements). Every CERNIQ output module carries a regulatory citation tag linking the metric to the specific NCUA examination criterion it satisfies. The Evidence Package (auto-generated, PDF format) includes the audit trail, assumption documentation, and model limitation disclosures that examiners require.

For COSSEC-regulated cooperativas: CERNIQ maps to Carta Circular COSSEC 2019-01 through 2023-04 examination areas. Section 4 of this playbook provides the complete module-to-regulatory-requirement mapping table with circular letter citations.

For community banks under OCC/FDIC supervision: CERNIQ produces outputs consistent with OCC Bulletin 2012-23 (Community Bank Stress Testing Guidance) and the Basel III interest rate risk in the banking book (IRRBB) framework.

**The exam-day test:** When an examiner asks "how did you arrive at this NII sensitivity figure," your team should be able to open CERNIQ's calculation trace, show the input data, show the scenario assumptions, show the path-by-path results, and show the aggregation methodology — in under five minutes. CERNIQ's audit trail architecture is designed specifically to answer that question.

---

**Question 3: "What is the ROI?"**

This calculation is not complicated.

| Cost Item | Annual Amount |
|---|---|
| ALM consultant (mid-range) | $25,000 |
| Finance team hours on ALM report (60 hrs/qtr × $85/hr burdened) | $20,400 |
| Emergency consultant engagement (1–2 per year) | $8,000 |
| **Total current ALM cost (conservative estimate)** | **$53,400** |

| CERNIQ Item | Annual Amount |
|---|---|
| CERNIQ subscription (Professional tier) | $7,188 ($599/month) |
| Finance team hours on ALM with CERNIQ (3 hrs/qtr × $85/hr) | $1,020 |
| **Total CERNIQ cost** | **$8,208** |

**Net annual savings: $45,192**
**First-year ROI: 450%**
**Payback period: 5.4 weeks**

These numbers use a mid-range subscription and a conservative estimate of current consultant spend. Institutions paying $40,000/year to their ALM consultant and running a lean team will see higher returns. Institutions at the $15,000 consultant spend level will still see savings exceeding $20,000 annually.

---

### CFO Decision Checklist: 10 Things to Verify Before Signing

The following checklist represents the standard due diligence framework for adopting a financial analytics platform. CERNIQ satisfies all ten criteria.

| # | Criterion | CERNIQ Status |
|---|---|---|
| 1 | Calculation methodology is documented and auditable | Passed — full methodology documentation available on request |
| 2 | Outputs are traceable to source data | Passed — audit trail links every output to input rows |
| 3 | Regulatory framework alignment is explicit | Passed — NCUA, COSSEC, OCC/FDIC mappings documented |
| 4 | Data is encrypted in transit and at rest | Passed — AES-256 at rest, TLS 1.3 in transit |
| 5 | Vendor has articulated model risk management policy | Passed — MRM policy document available; Section 2 covers this in full |
| 6 | Pricing is transparent with no hidden fees | Passed — flat monthly fee, no per-report or per-user overage charges |
| 7 | User training and onboarding is included | Passed — full 6-module curriculum, see Section 9 |
| 8 | Platform produces board-ready output without additional formatting | Passed — 14-page PDF report generated automatically |
| 9 | Vendor has roadmap for SOC 2 Type II certification | Passed — SOC 2 Type II certification in progress; current security controls documented |
| 10 | Contract includes SLA with uptime and response commitments | Passed — 99.5% uptime SLA, 4-hour response for critical issues |

---

### Approval Chain: Getting CERNIQ Approved by Board and Audit Committee

Most community financial institutions require new technology vendor approvals to pass through IT, legal, internal audit, and board committees. The following sequence minimizes approval friction.

**Step 1 — IT and Security Review (Week 1)**
Request CERNIQ's security questionnaire responses. Key documents: data flow diagram, encryption specification, access control policy, incident response plan. CERNIQ's cloud infrastructure runs on AWS with data residency in the US (or applicable regional zone for international clients). For institutions with specific data residency requirements, see the objection response in Section 8.

**Step 2 — Legal and Contract Review (Week 1–2)**
CERNIQ's standard agreement is a cloud services agreement with standard SaaS terms. Key provisions to confirm: data ownership remains with the institution, CERNIQ does not sell or share client data, termination provisions include data export rights. No unusual liability or indemnification terms.

**Step 3 — Internal Audit or Compliance Pre-Review (Week 2)**
Provide internal audit with the Model Risk Management documentation (Section 2 of this playbook) and the Regulatory Compliance Map (Section 4). The MRM documentation explains how CERNIQ fits within the institution's model inventory and what ongoing monitoring is required.

**Step 4 — ALM Committee or Risk Committee Endorsement (Week 2–3)**
Present the parallel-run validation results (one quarter of CERNIQ running alongside existing model, with delta analysis). This is the most persuasive evidence for technical committees.

**Step 5 — Board or Executive Committee Approval (Week 3–4)**
For board approval, the presentation should cover: vendor due diligence summary, ROI analysis, regulatory alignment, pilot results, and proposed implementation timeline. The board presentation template in Section 6 can be adapted for this purpose.

---

## SECTION 2: THE RISK MANAGER'S TECHNICAL VALIDATION

### Independent Validation Methodology

No risk manager should adopt a quantitative model without independent validation. CERNIQ's architecture is designed to make this validation straightforward. The following protocol provides a rigorous, documented validation process.

---

### The Parallel-Run Protocol (One Quarter)

**Objective:** Confirm that CERNIQ's outputs are consistent with your existing model, understand the sources of any differences, and document the validation findings for your model inventory.

**Week 1 — Baseline Establishment**
- Export your most recent quarter-end balance sheet in CERNIQ's CSV format (schema in Section 3)
- Run CERNIQ's full analysis suite on this data
- Document CERNIQ's outputs: Duration Gap, NII Sensitivity (±100, ±200, ±300 bps), EVE sensitivity, LCR, Net Worth Ratio
- Document your existing model's outputs for the same metrics using the same period-end data

**Week 2 — Delta Analysis**
Compare outputs metric by metric. Expected deltas and their causes:

| Metric | Typical Delta | Primary Cause |
|---|---|---|
| Duration Gap | ±0.05–0.15 years | Key-rate vs. parallel shift methodology |
| NII Sensitivity +200 bps | ±1–3% of net interest income | Path count and repricing assumption differences |
| EVE Sensitivity +300 bps | ±2–5% of EVE | Discount rate curve construction differences |
| LCR | ±0–2% | Cash flow timing convention differences |

**Deltas outside these ranges** indicate a data mapping issue (most common), a materially different assumption about prepayment speeds or repricing, or an error in one of the models. CERNIQ's calculation trace allows you to identify which inputs drive the delta.

**Week 3 — Assumption Reconciliation**
Review CERNIQ's default assumptions against your existing model:
- Prepayment speed assumptions (CERNIQ uses PSA-based speeds calibrated to community institution historical prepayment data)
- Repricing lag assumptions (CERNIQ uses regulatory-standard assumptions as defaults, all overridable)
- Non-maturity deposit assumptions (CERNIQ applies NCUA-consistent beta and decay assumptions; these are the most commonly adjusted items)

**Week 4 — Validation Report**
Document findings in the format required by your Model Risk Management framework. CERNIQ provides a Model Validation Template pre-populated with the platform's methodology documentation.

---

### Why CERNIQ Is More Accurate Than a Manual Excel Model

This is not a marketing claim. It is a consequence of five specific engineering decisions:

**1. No floating-point arithmetic.**
Excel uses 64-bit IEEE 754 double-precision floating point. On large balance sheets with many line items, accumulated rounding error in Excel can reach 5–15 basis points in duration calculations. This is not catastrophic in isolation, but it compounds when you run scenario analysis across hundreds of interest rate paths.

**2. Consistent scenario construction.**
Excel models typically hard-code rate shock scenarios as parallel shifts of ±100, ±200, ±300 basis points. CERNIQ constructs 12 standard scenarios including parallel shifts, bear steepeners, bull flatteners, and twist scenarios. More importantly, CERNIQ's stochastic engine generates 10,000 correlated rate paths using a two-factor Hull-White model, calibrated to the current yield curve. This means the NII distribution you see reflects actual rate dynamics, not just point estimates.

**3. No manual data entry errors.**
The most common source of error in Excel-based ALM is not the model logic — it is the quarterly data entry process. A miskeyed balance, a missed line item, or a formula that was not extended to a new row. CERNIQ's CSV import with automated data quality checks (see Section 3) eliminates this entire error category.

**4. Version control.**
Excel models are notoriously difficult to version. CERNIQ maintains a complete versioned history of every analysis run, including the input data hash, the software version, and all assumption overrides. You can reproduce any past analysis exactly.

**5. Centralized assumption management.**
In most institutions, prepayment assumptions, repricing lag tables, and beta coefficients for non-maturity deposits live in spreadsheet cells that can be changed accidentally or without documentation. CERNIQ stores all assumptions in a versioned assumption registry with change history and approval workflow.

---

### Key Calculation Choices: The Technical Rationale

**Why 10,000 Monte Carlo paths?**
The standard error of a tail-percentile estimate (e.g., 95th percentile of NII loss) from a Monte Carlo simulation decays as 1/√N, where N is the number of paths. At N=1,000, standard errors on tail estimates are high enough to introduce material uncertainty. At N=10,000, standard errors are approximately 0.3% of the range — well within acceptable precision for ALM purposes. Increasing to 100,000 paths reduces this further but provides diminishing returns for community institution balance sheets.

**Why Decimal, not Float?**
Python's `decimal.Decimal` with 28-digit precision ensures that the sum of 10,000 path-level NII estimates equals the expected value to within sub-cent precision on a multi-billion-dollar balance sheet. This matters for audit and reconciliation purposes.

**Why key-rate durations?**
The NCUA and COSSEC both require that institutions demonstrate sensitivity to realistic rate scenarios, not just theoretical parallel shifts. Key-rate duration analysis identifies which specific parts of the yield curve your balance sheet is most sensitive to. A balance sheet heavy in 5-year fixed-rate mortgages has high 5-year key-rate duration but may have low 2-year key-rate duration. Parallel shift analysis will miss this distinction. Key-rate analysis also makes hedging decisions more precise — if you are considering adding a derivative hedge, key-rate duration tells you which tenor to target.

---

### Model Risk Management Framework Integration

CERNIQ is classified as a **Tier 2 model** under standard MRM frameworks (material model used for regulatory reporting, but not a trading or pricing model). The following MRM documentation is available from CERNIQ:

- **Model Conceptual Soundness Documentation** — describes the theoretical basis for each calculation module
- **Model Limitation Disclosure** — explicit statement of what CERNIQ does not model (e.g., optionality in complex structured products, counterparty credit risk on derivatives)
- **Ongoing Monitoring Plan** — quarterly benchmarking metrics and annual revalidation protocol
- **Change Management Log** — all methodology changes are documented with effective dates and backward compatibility notes
- **Independent Validation Package** — third-party review materials (available upon request for institutions requiring external model validation)

For institutions subject to NCUA's model risk guidance, CERNIQ fits the following model inventory classification: "Interest Rate Risk Management Model — Market Risk Category — Periodic Use (Quarterly)."

---

## SECTION 3: THE TREASURER'S INTEGRATION GUIDE

### Balance Sheet CSV Format Specification

CERNIQ's import format is designed for direct export from core banking systems with minimal transformation. The required schema is as follows:

```
account_id          | string(50)  | Unique account identifier from chart of accounts
account_name        | string(200) | Human-readable account name
category            | string(50)  | CERNIQ ALM category (see mapping guide below)
balance             | decimal     | End-of-period balance in reporting currency (positive = asset)
rate                | decimal     | Current rate (e.g., 0.0475 for 4.75%)
rate_type           | string(10)  | FIXED, VARIABLE, HYBRID, NONMATURITY
index               | string(20)  | Rate index if variable (PRIME, SOFR, LIBOR-legacy, etc.)
spread              | decimal     | Spread over index if variable (e.g., 0.0200 for +200 bps)
reprice_date        | date        | Next repricing date (YYYY-MM-DD)
maturity_date       | date        | Final maturity date (YYYY-MM-DD; blank for nonmaturity)
next_payment_date   | date        | Next scheduled payment date
payment_frequency   | string(10)  | MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, BULLET
original_balance    | decimal     | Original balance at origination (for prepayment modeling)
origination_date    | date        | Origination date
call_date           | date        | First call date if callable (blank if not applicable)
put_date            | date        | Put date if putable (blank if not applicable)
floor_rate          | decimal     | Rate floor if applicable
cap_rate            | decimal     | Rate cap if applicable
currency            | string(3)   | ISO 4217 currency code (USD, EUR, etc.)
segment             | string(50)  | Optional: segment/branch/product line code
notes               | string(500) | Optional: free text for special handling flags
```

**Minimum required fields:** `account_id`, `account_name`, `category`, `balance`, `rate`, `rate_type`, `maturity_date` (or flag as nonmaturity), `currency`

**File format:** UTF-8 encoded CSV with header row. File size limit: 50MB (sufficient for approximately 500,000 line items, well above the largest community institution balance sheet).

---

### Core Banking System Export Guides

**FiServ (Portico / Episys / DNA)**
Navigate to: Reports → General Ledger → Balance Sheet Detail Export. Select "ALM Export Format" if configured, or request IT to create a custom extract using the field mapping table. FiServ's standard report writer produces the required fields. Key mapping: FiServ's "Rate Code" maps to CERNIQ's `rate_type`; FiServ's "Maturity Date" maps directly. Export as CSV from the report viewer.

**Jack Henry (Symitar / SilverLake)**
Symitar: Use the PowerOn or RepGen reporting tool. The standard GL export includes all required fields. Map Symitar's "Share/Loan Type" code to CERNIQ's `category` field using the mapping guide below. SilverLake: Standard ALCO report export includes balance, rate, and maturity data. Export format is tab-delimited by default — convert to CSV or use CERNIQ's tab-delimited import option.

**Open Solutions (DNA)**
DNA's ALCO Report module produces an export closely aligned with CERNIQ's format. Navigate to: ALCO → Interest Rate Risk → Export Data. Select "Detailed Position Export." Map DNA's position types to CERNIQ categories using the table below.

**Coopcentral (Puerto Rico / Latin America)**
Coopcentral's export function is accessible via: Reportes → Balance General → Exportar Detalle. The export produces a columnar report; use CERNIQ's Coopcentral Import Template (available in the platform under Settings → Import Templates) to map the column layout automatically.

**Manual / Other Systems**
If your core does not have a standard export, CERNIQ provides a manual entry template in Excel format. This is the only scenario where manual data entry is required, and it is suitable only for institutions with fewer than 200 balance sheet line items.

---

### Data Quality Validation: What CERNIQ Checks Before Running

CERNIQ runs 18 automated data quality checks on every import before executing any analysis. These checks prevent calculation errors and flag data issues that would otherwise propagate silently into the report.

| Check | What It Tests | Action if Failed |
|---|---|---|
| Balance completeness | All major ALM categories present | Warning: list missing categories |
| Rate reasonableness | All rates between 0.00% and 25.00% | Error: flag outliers for review |
| Maturity date logic | Maturity dates not in the past (for non-matured items) | Warning: list items to confirm |
| Balance sign convention | Assets positive, liabilities negative | Error: flag sign inconsistencies |
| Category coverage | At least 90% of balance sheet categorized | Error: require mapping of uncategorized items |
| Repricing date logic | Variable-rate items have repricing date ≤ maturity date | Error: flag conflicts |
| Currency consistency | All items in same currency (or explicit multi-currency flag) | Warning: confirm multi-currency handling |
| Duplicate account IDs | No duplicate `account_id` values | Error: require resolution |
| Non-maturity deposit flag | Non-maturity deposits flagged correctly | Warning: prompt for review |
| Total asset reconciliation | Sum of asset balances within 0.1% of reported total assets | Warning: request confirmation |
| Index completeness | Variable-rate items have index specified | Error: require index assignment |
| Spread reasonableness | Spreads between -500 and +1000 bps | Warning: flag outliers |
| Payment frequency vs. type | Bullet loans not flagged as monthly payment | Warning: confirm |
| Floor/cap consistency | Floor ≤ current rate ≤ cap where applicable | Warning: flag inconsistencies |
| Origination date logic | Origination dates not in the future | Error: flag for correction |
| Call date logic | Call dates between origination and maturity | Error: flag conflicts |
| Balance materiality | No single line item > 50% of total assets without confirmation | Warning: prompt confirmation |
| Segment code consistency | Segment codes match defined segments in settings | Warning: flag unknown codes |

---

### Chart of Accounts Mapping Guide

CERNIQ organizes balance sheet items into 24 ALM categories. The following mapping covers the most common account types:

**Asset Categories**
- `CASH_EQUIVALENTS` — Vault cash, fed funds sold, interest-bearing deposits at other institutions
- `INVESTMENTS_FIXED` — Fixed-rate investment securities (Treasuries, agency bonds, MBS with fixed rate)
- `INVESTMENTS_VARIABLE` — Variable-rate investment securities, CMOs with variable rates
- `INVESTMENTS_EQUITY` — FHLB stock, FNMA stock, other equity investments
- `LOANS_FIXED_MORTGAGE` — Fixed-rate 1-4 family mortgage loans
- `LOANS_ARM_MORTGAGE` — Adjustable-rate mortgage loans
- `LOANS_COMMERCIAL` — Commercial real estate, C&I loans
- `LOANS_CONSUMER_FIXED` — Fixed-rate auto, personal, consumer loans
- `LOANS_CONSUMER_VARIABLE` — Variable-rate consumer loans, HELOCs
- `LOANS_PARTICIPATIONS` — Loan participations purchased
- `LOANS_SBA` — SBA guaranteed loans
- `FIXED_ASSETS` — Premises, equipment (non-earning, excluded from interest rate analysis)
- `OTHER_ASSETS` — NCUA share insurance, prepaid items, other non-earning assets

**Liability Categories**
- `DEPOSITS_NONMATURITY_CHECKING` — Regular checking, business checking (non-interest bearing)
- `DEPOSITS_NONMATURITY_SAVINGS` — Regular savings, money market accounts
- `DEPOSITS_NONMATURITY_NOW` — NOW accounts, interest-bearing checking
- `DEPOSITS_CD_FIXED` — Fixed-rate certificates of deposit, time deposits
- `DEPOSITS_CD_VARIABLE` — Variable-rate time deposits
- `BORROWINGS_FHLB` — FHLB advances
- `BORROWINGS_FEDERAL` — Federal funds purchased, discount window
- `BORROWINGS_OTHER` — Subordinated debt, notes payable
- `LOAN_PARTICIPATIONS_SOLD` — Loan participations sold (off-balance-sheet flag available)

**Equity / Capital**
- `NET_WORTH` — Retained earnings, net worth
- `OTHER_EQUITY` — Accumulated other comprehensive income/loss, other capital accounts

---

### Handling Unusual Items

**Loan Participations**
Purchased participations: classify as the underlying loan type (e.g., a participation in a commercial real estate loan goes to `LOANS_COMMERCIAL`). Set `notes` to `PARTICIPATION_PURCHASED` for the audit trail. Sold participations: use `LOAN_PARTICIPATIONS_SOLD` category with balance representing the sold portion.

**Off-Balance-Sheet Commitments**
CERNIQ handles unfunded loan commitments and lines of credit through the Off-Balance-Sheet module. These items are entered separately from the main balance sheet CSV using the commitment template (available in Settings → Additional Inputs). They affect NII sensitivity calculations in rising-rate scenarios where draw-down probability increases.

**Derivative Hedges**
Interest rate swaps, caps, and floors are entered in the Derivatives module. CERNIQ handles pay-fixed/receive-float swaps (the most common community institution hedge), pay-float/receive-fixed swaps, interest rate caps, and interest rate floors. For each derivative, provide: notional amount, fixed rate, floating rate index, effective date, maturity date, and hedge designation (fair value vs. cash flow hedge).

---

### Monthly/Quarterly Data Refresh Workflow

**Recommended cadence:** Quarterly full refresh + monthly abbreviated refresh (large institutions only)

**Quarterly Workflow (3–4 hours total)**
1. Export balance sheet from core system (30 minutes)
2. Upload CSV to CERNIQ and resolve any data quality flags (30–60 minutes)
3. Review and confirm assumption updates (non-maturity deposit betas, prepayment speeds) (30 minutes)
4. Run full analysis suite — all 12 modules (automated, 5–10 minutes processing time)
5. Review outputs, flag any metrics outside policy limits (30 minutes)
6. Customize executive narrative sections (30 minutes)
7. Generate and distribute 14-page board report (5 minutes)
8. Archive report and evidence package (automated)

**Monthly Abbreviated Workflow (1–2 hours, optional)**
1. Update high-velocity balance sheet items (certificates, FHLB borrowings) (20 minutes)
2. Run NII Sensitivity and LCR modules only (5 minutes processing)
3. Review for material changes vs. prior month (15 minutes)
4. Distribute summary memo if material changes detected

---

## SECTION 4: THE COMPLIANCE OFFICER'S REGULATORY MAP

### NCUA IRR Examination — CERNIQ Module Mapping

The NCUA examines interest rate risk under Letter to Credit Unions 10-CU-03 and the NCUA Examiner's Guide, Part II, Chapter 7. The following table maps each examination area to the CERNIQ module that satisfies it:

| NCUA Examination Area | Regulation Reference | CERNIQ Module | Output |
|---|---|---|---|
| IRR policy documentation | NCUA Rules §741.3(b)(5) | Policy Compliance | Automated policy limit vs. actual comparison |
| Board oversight of IRR | LCU 10-CU-03, §III | Board Report | 14-page board-ready report with approval workflow |
| Measurement systems adequacy | LCU 10-CU-03, §IV.A | All Core Modules | Full suite: Duration, NII, EVE, LCR |
| Stress testing under adverse scenarios | LCU 10-CU-03, §IV.B | Scenario Analysis | 12 rate scenarios including +300 bps shock |
| Non-maturity deposit assumptions | NCUA Examiner's Guide Ch.7 | NMD Assumptions | Beta and decay analysis with justification |
| Model validation | LCU 10-CU-03, §IV.C | Validation Package | Methodology docs, audit trail, limitation disclosure |
| Internal controls | §741.3(b)(5) | Audit Trail | Immutable calculation trace, version history |
| Management information systems | LCU 10-CU-03, §IV.D | Dashboard | Real-time metric dashboard with trend analysis |

---

### COSSEC Examination — CERNIQ Module Mapping

| Área de Examen COSSEC | Referencia Normativa | Módulo CERNIQ | Producto |
|---|---|---|---|
| Política de riesgo de tasa de interés | Carta Circular 2019-01 | Cumplimiento de Política | Comparación automática límites vs. actual |
| Análisis de brechas (GAP) | Carta Circular 2020-03, §4.2 | Duration Gap | Análisis de brecha por madurez y reprecio |
| Sensibilidad del margen financiero | Carta Circular 2020-03, §4.3 | NII Sensitivity | Sensibilidad ±100, ±200, ±300 pb |
| Valor económico del patrimonio | Carta Circular 2021-02, §3.1 | EVE Analysis | EVE bajo 6 escenarios de tasa |
| Liquidez y coeficiente de cobertura | Carta Circular 2022-01 | LCR Module | Coeficiente de cobertura de liquidez |
| Pruebas de tensión | Carta Circular 2023-04, §5 | Stress Testing | Escenarios adversos documentados |
| Informe a la Junta | Carta Circular 2019-01, §7 | Board Report | Informe de 14 páginas para Junta Directiva |
| Documentación del modelo | Carta Circular 2023-04, §6 | Paquete de Validación | Documentación metodológica completa |

---

### Examination Response Playbook

When an examiner questions a CERNIQ output, the response sequence is:

**Step 1 — Open the Calculation Trace**
Every CERNIQ output has a linked calculation trace accessible via the audit icon. This shows: the exact input data used, the date and time of the run, the software version, and the full calculation sequence.

**Step 2 — Show the Assumption Registry**
Navigate to Settings → Assumption Registry. Show the examiner all assumptions used in the flagged calculation: prepayment speeds, repricing lags, NMD betas, scenario definitions. Each assumption entry shows when it was set and by whom.

**Step 3 — Provide the Model Limitation Disclosure**
CERNIQ's Model Limitation Disclosure (one page, auto-generated) lists what the model does not capture. If the examiner's concern relates to an item on the limitation list, acknowledge it and describe the compensating control.

**Step 4 — Offer Sensitivity Analysis**
CERNIQ can re-run any analysis with modified assumptions in under 10 minutes. If an examiner wants to see how results change under a different NMD assumption, run it on the spot.

---

### Evidence Package: What CERNIQ Auto-Generates for Exam Prep

CERNIQ's Exam Prep module generates the following package automatically, quarterly:

- **Regulatory Compliance Checklist** — each NCUA/COSSEC requirement, whether it is met, and the CERNIQ output that satisfies it
- **Board Certification Record** — log of board reviews, dates, and any policy exceptions approved
- **Model Validation Summary** — last validation date, findings, and remediation status
- **Assumption Documentation** — complete assumption registry with rationale for any non-default choices
- **Calculation Audit Trail** — immutable record of every analysis run in the period
- **Policy Exception Log** — all instances where a metric exceeded policy limits, with management response
- **Trend Analysis Report** — 8-quarter history of key metrics with peer benchmarks where available

---

## SECTION 5: THE ANALYST'S WORKFLOW GUIDE

### Day-in-the-Life: Before and After CERNIQ

**BEFORE CERNIQ — Quarterly ALM Cycle (Typical)**

The quarter ends on a Friday. On Monday, the finance analyst begins the data pull from the core banking system. This takes a full day — the core report is not exactly what the Excel model needs, so manual adjustments are required. Balances need to be re-entered into the ALM template. Two days later, the model is populated.

Scenario analysis takes another day — running six interest rate scenarios across the model, checking that the formulas extended correctly to the new quarter's data, verifying that the results are sensible. Something looks off in the +300 bps scenario. Two hours of debugging reveal a formula error introduced when a new product type was added in Q3. Back to the beginning.

The draft report is ready on Thursday of week two. The consultant reviews it over the weekend and sends back comments on Monday. Revisions take half a day. The board report is formatted in PowerPoint over the next two days. Total elapsed time: 12 business days. Total analyst hours: 55–70.

**AFTER CERNIQ — Quarterly ALM Cycle**

The quarter ends on a Friday. On Monday morning, the analyst exports the balance sheet CSV from the core system (30 minutes). The file is uploaded to CERNIQ. Three data quality flags appear: one rate value is missing for a new loan product, one certificate maturity date format is incorrect, one balance sign is wrong. All three are resolved in 20 minutes by editing the CSV and re-uploading.

CERNIQ processes the full analysis suite in 8 minutes. The analyst reviews all 12 module outputs, checking for anything outside policy limits. There are two items to flag: NII sensitivity in the +200 bps scenario is at the outer edge of the policy limit, and the LCR ratio has declined from last quarter. The analyst writes three paragraphs of narrative commentary using CERNIQ's AI-generated draft as a starting point.

The 14-page board report is generated, reviewed, and approved by the CFO via the built-in approval workflow. Total elapsed time: 1 business day. Total analyst hours: 3.5.

---

### Module-by-Module Workflow

Run modules in the following order to ensure each module can use the outputs of prior modules:

1. **Data Import and Validation** — always first; resolve all flags before proceeding
2. **Duration Gap Analysis** — foundation for subsequent interest rate sensitivity analysis
3. **Repricing Gap Analysis** — identifies short-term repricing imbalances
4. **NII Sensitivity (Deterministic)** — run six standard scenarios: ±100, ±200, ±300 bps parallel
5. **NII Sensitivity (Stochastic)** — 10,000 path Monte Carlo; takes the longest to process
6. **EVE Analysis** — economic value sensitivity across same six scenarios
7. **Key-Rate Duration** — identifies which yield curve tenors drive the most exposure
8. **Non-Maturity Deposit Analysis** — validates current beta and decay assumptions
9. **Liquidity Coverage Ratio** — requires prior period comparison for trend analysis
10. **Stress Testing** — adverse scenarios beyond standard shocks
11. **Peer Benchmarking** — compares your metrics to sector quartiles (where benchmark data available)
12. **Board Report Generation** — consolidates all outputs into the 14-page report

---

### Interpreting Outputs: Key Metrics in Plain Language

**Duration Gap**
Duration Gap measures how many years faster your assets reprice than your liabilities. A positive duration gap means your liabilities reprice slower than your assets — you benefit in rising-rate environments. A negative gap means your assets reprice slower — you are exposed to rising rates. A duration gap above +3.0 years or below -1.0 years typically triggers policy review at most community institutions. Example: A duration gap of +1.5 years means that if rates rise 100 bps, your Net Interest Income is expected to improve. If rates fall 100 bps, NII is expected to decline.

**NII Sensitivity**
NII Sensitivity shows the percentage change in Net Interest Income under each rate scenario over a 12-month forward horizon. Common policy limits: NII sensitivity should not decline more than 10–15% in the +200 bps scenario. If CERNIQ shows -8% NII sensitivity under +200 bps, that means a 200-basis-point rate increase would reduce your projected NII by 8% relative to the base case. Whether this is concerning depends on where you are in the policy limit.

**EVE Sensitivity (Economic Value of Equity)**
EVE represents the present value of all future cash flows from your balance sheet — essentially, what your institution would be worth if all assets and liabilities were marked to market. EVE sensitivity shows how this value changes under each rate scenario. This is the metric most sensitive to long-duration fixed-rate assets. An institution with a large portfolio of 30-year fixed-rate mortgages will show high EVE sensitivity to rising rates.

**LCR (Liquidity Coverage Ratio)**
LCR measures whether you have enough high-quality liquid assets to cover expected net cash outflows over a 30-day stress period. Regulatory minimum is typically 100%. CERNIQ calculates LCR components per the Basel III framework as adapted for community institutions.

---

## SECTION 6: THE BOARD PRESENTATION KIT

### 8-Slide Board Deck Outline

**Slide 1 — Executive Summary**
Institution name, reporting date, overall risk rating (Green/Yellow/Red based on policy limits), one-sentence status statement, key action items if any.

**Slide 2 — Interest Rate Risk Dashboard**
Four KPI tiles: Duration Gap (actual vs. limit), NII Sensitivity +200 bps (actual vs. limit), EVE Sensitivity +300 bps (actual vs. limit), Policy Compliance Status. Traffic light indicators.

**Slide 3 — NII Sensitivity: Rate Scenarios**
Bar chart showing NII change under six scenarios: -200, -100, flat, +100, +200, +300 bps. Policy limits shown as horizontal lines. Prior quarter comparison.

**Slide 4 — EVE Analysis**
Similar bar chart for EVE sensitivity. Include 8-quarter trend line. Highlight if any scenario approaches or breaches policy limit.

**Slide 5 — Liquidity Position**
LCR gauge chart. Available liquidity sources table. Borrowing capacity summary. Trend over prior four quarters.

**Slide 6 — Balance Sheet Composition and Trends**
Asset mix pie chart. Liability mix pie chart. Quarter-over-quarter changes in key categories. Rate and maturity profile summary.

**Slide 7 — Regulatory Compliance Status**
NCUA/COSSEC readiness checklist. Any examination findings from prior cycle. Policy exception log (empty if no exceptions). Model validation status.

**Slide 8 — Management Recommendations and Next Steps**
Any metrics approaching policy limits: what management recommends. Proposed changes to assumptions or policy limits if any. Next ALM committee date. Any actions requiring board approval.

---

### Explaining Metrics to Non-Technical Board Members

**Duration Gap:** "Think of it as a balance. Our loans and investments are on one side; our deposits and borrowings are on the other. Duration Gap measures which side is more sensitive to interest rate changes. A positive gap means rising rates are good for us — our assets adjust faster than our liabilities. Our current gap of [X] years is within our policy range of [-1 to +3 years]."

**NII Sensitivity:** "This answers the question: if interest rates go up by 2%, how does our income change? We are showing a [X]% change. Our policy allows up to a [Y]% change. We are [well within / approaching / outside] our limit."

**EVE:** "This is what our institution would be worth on paper if we had to mark everything to market today. It's especially sensitive to our long-term fixed-rate loans. Rising rates reduce EVE because those loans are worth less in a higher-rate environment. Our current EVE sensitivity under the stress scenario is [X]%, against a policy limit of [Y]%."

---

## SECTION 7: THE IMPLEMENTATION TIMELINE

### Day 1: First Report in 30 Minutes

1. Create CERNIQ account (5 minutes — email, institution name, tier selection)
2. Download the CSV template from Settings → Import Templates (2 minutes)
3. Export balance sheet from core system and map to template (15 minutes for most systems with the mapping guide)
4. Upload CSV — CERNIQ runs data quality checks and flags any issues (2 minutes)
5. Resolve any flags (typically 0–3 items on the first import) (5 minutes)
6. Click "Run Full Analysis" — processing completes in 5–10 minutes
7. Review outputs, click "Generate Board Report" — PDF downloads immediately

Total time from account creation to first board-ready report: 30–45 minutes.

### Week 1: Calibrate to Your ALM Policy
Review CERNIQ's default assumption set against your institution's approved ALM policy. Adjust: policy limit thresholds, NMD beta and decay assumptions, prepayment speed assumptions, standard scenario definitions. Each change is logged with your name, date, and rationale. Recommendation: run the adjusted analysis and confirm outputs are consistent with your last quarterly report before the parallel period begins.

### Week 2: Train Internal Team
Conduct the Module 1–3 training sessions from Section 9 with your finance team. The objective: every team member can independently run the quarterly workflow without assistance. Assign primary and backup operators for the ALM reporting process.

### Week 3: First ALM Committee Presentation
Use CERNIQ's outputs for your next ALM committee meeting. Prepare the 8-slide deck using the template in Section 6. Brief the committee on CERNIQ's validation status and parallel-run findings. Obtain committee endorsement to adopt CERNIQ as the primary ALM reporting tool.

### Month 1: Establish Quarterly Rhythm
Complete the quarterly workflow twice (on current and prior quarter data). Confirm all outputs reconcile with prior model. Document the final parallel-run validation report. Begin the vendor approval process for board sign-off if not already complete.

### Month 3: First Examination Cycle
At the next regulatory examination or examination preparation cycle, use CERNIQ's Evidence Package as your primary documentation submission. The package covers every standard NCUA/COSSEC IRR examination area. Have the Examination Response Playbook (Section 4) accessible for your team during the examination.

### Year 1: Full ROI Realized
By the end of the first year: ALM consultant dependency eliminated or substantially reduced, quarterly reporting time reduced from 55–70 hours to 3–4 hours, examination documentation produced automatically, finance team trained and certified on CERNIQ, board receiving consistent 14-page reports each quarter.

---

## SECTION 8: OBJECTION HANDLING — FINANCE TEAM EDITION

### "Our Excel model is good enough."

The question is not whether your Excel model produces numbers. It is whether those numbers are defensible, reproducible, and accurate enough to make material capital allocation decisions.

Excel ALM models fail in four specific ways that become visible only in adverse conditions:

**Failure Mode 1 — Formula drift.** When you add a new product type, extend the repricing schedule, or add a line item, formulas often do not extend correctly. This is the single most common cause of ALM model errors discovered during examinations. CERNIQ has no formulas that can drift — the calculation engine is fixed code.

**Failure Mode 2 — Version contamination.** When your ALM analyst leaves and their replacement inherits the model, undocumented formula assumptions, overridden cells, and hard-coded values become invisible landmines. CERNIQ maintains a complete assumption registry.

**Failure Mode 3 — Parallel shift limitation.** As described in Section 2, Excel models that analyze only parallel shifts are missing the actual risk profile of your balance sheet. The 2022–2023 rate cycle produced a bear-steepener that most parallel-shift models underestimated significantly.

**Failure Mode 4 — Audit trail absence.** When an examiner asks "how did you get this number," an Excel model typically cannot answer that question in a way that satisfies an examiner. CERNIQ can.

---

### "We already pay a consultant. The relationship has value."

This objection deserves a careful answer. ALM consultants provide two types of value: analytical (producing the report) and advisory (interpreting results and recommending action). CERNIQ replaces the analytical function. The advisory function — knowing when a Duration Gap of +2.8 years in this specific rate environment warrants attention — is where experienced judgment matters.

The math: if your consultant charges $25,000/year and spends 60% of that effort producing the report, you are paying $15,000/year for a function that CERNIQ performs in 8 minutes. The remaining $10,000 for genuine advisory judgment is worth retaining — at an hourly rate, on demand, not as a retainer for report production.

Many CERNIQ clients retain their consultant relationships while eliminating the quarterly report production fee. The consultant becomes a strategic advisor rather than a data processor.

---

### "Our data is too complex for a tool like this."

Specify the complexity. CERNIQ handles: multiple currencies, loan participations, off-balance-sheet commitments, derivative hedges (swaps, caps, floors), callable bonds, putable deposits, adjustable-rate mortgages with caps and floors, hybrid products that transition from fixed to variable rate, and non-standard repricing indices. The CSV schema in Section 3 covers all of these explicitly.

If your institution has a genuinely unusual instrument type — subordinated debt with complex contingent payment features, for example — CERNIQ's `notes` field allows flagging for manual review. The platform will process the item using the closest standard category and disclose the approximation in the Model Limitation section of the report.

What CERNIQ does not handle: complex structured products (CDOs, CLOs), trading book positions, OTC derivatives with path-dependent payoffs, or credit risk modeling. If these items are material to your balance sheet, you are likely a large bank with a dedicated quant team — not the target user.

---

### "What if the calculations are wrong?"

This is the right question. The answer has four components:

1. **Architecture:** The calculation engine is deterministic, version-controlled code. The same inputs always produce the same outputs. There is no formula drift, no accidentally overridden cell.

2. **Audit trail:** Every calculation is traceable to the source input row. If a number looks wrong, you can trace it backward to the data that produced it in under five minutes.

3. **Parallel validation:** The parallel-run protocol in Section 2 gives you one quarter of side-by-side comparison. Any systematic bias in CERNIQ's calculations would be visible in that comparison.

4. **Change management:** All methodology changes are announced in advance with effective dates. You are never surprised by a changed calculation.

If, after all of this, a calculation error is discovered, CERNIQ's SLA includes correction and reprocessing within 24 hours, with an updated report and a disclosure memo suitable for regulatory notification.

---

### "We need local implementation, not cloud."

CERNIQ is a cloud-native platform, and the architecture is designed for security, not convenience. Your balance sheet data is encrypted with AES-256 at rest, transmitted via TLS 1.3, and stored in your institution's private data partition — logically isolated from other clients. Access is controlled by role-based authentication with MFA required.

Data residency: US client data is stored exclusively in US AWS regions (us-east-1 / us-west-2). Puerto Rico cooperativa data is stored in the US-East region. Latin American clients can request regional data residency as part of the enterprise agreement.

For institutions with strict data residency requirements or regulatory mandates for on-premises processing, contact CERNIQ's enterprise team to discuss dedicated deployment options.

---

### "Our board won't approve a new vendor."

The vendor approval process for CERNIQ is the same as for any SaaS financial services tool. The standard due diligence package includes: security questionnaire responses, data processing agreement, service level agreement, SOC 2 Type II certification (in progress; current controls documentation available), business continuity plan, and executive reference contacts.

For institutions that require SOC 2 Type II before approval: CERNIQ's SOC 2 engagement is underway. Estimated completion: Q3 2026. In the interim, the security controls documentation and penetration test results (available under NDA) satisfy most institution security review processes.

Board approval timeline using the chain in Section 1: 3–4 weeks for standard approval. Expedited approval (8–10 business days) available for institutions with examination cycle urgency.

---

### "We've tried ALM software before and it was a nightmare."

Prior ALM software implementations failed for predictable reasons: implementations required months of configuration, required dedicated IT resources, produced outputs that needed significant post-processing to be presentable, and had learning curves steep enough that only one person in the institution ever learned to use the tool.

CERNIQ's architecture is defined by the opposite design principles. Upload-and-run takes 30 minutes on Day 1. The board-ready report requires no post-processing. The interface is designed for finance professionals, not quants. If the person who runs CERNIQ leaves, their replacement can be productive within one week using the training curriculum in Section 9.

The single biggest predictor of ALM software failure is the gap between the software's output and the board report. CERNIQ eliminates that gap by making board-ready output the primary deliverable, not an afterthought.

---

### "We're too small to need this."

If your institution has total assets above $10 million and a lending program, you have interest rate risk. COSSEC findings for inadequate IRR documentation carry remediation costs that typically exceed $15,000 per finding cycle — in management time, consultant fees, and in some cases, examination-mandated capital actions.

The question is not whether you are too small. The question is: what does an inadequate IRR management finding cost you? The answer: more than a CERNIQ subscription. Every time.

For the smallest cooperativas and credit unions (under $50M assets), CERNIQ's Starter tier at $299/month provides all core ALM modules. Annual cost: $3,588. Annual savings vs. a minimal consultant engagement: $10,000 minimum.

---

## SECTION 9: THE FINANCE TEAM TRAINING CURRICULUM

### CERNIQ Certified ALM Analyst Program

Six modules, 14 training hours total, delivered via live webinar or self-paced video. Completion of all six modules and the final assessment qualifies participants for the CERNIQ Certified ALM Analyst designation — recognized internally as the institution's qualified ALM professional for examination purposes.

---

**Module 1 — CERNIQ Fundamentals (2 hours)**
Platform navigation, account settings, user management. Import workflow from end to end. Understanding the dashboard: what each metric is, where it comes from, what normal looks like. Accessing reports, the audit trail, and the assumption registry. Assessment: complete a data import and run one module independently.

**Module 2 — ALM Theory Refresher (3 hours)**
This module does not assume prior ALM expertise. It teaches the concepts behind every CERNIQ output.

*Duration* — the weighted average time until cash flows are received or paid. Why it matters: it measures price sensitivity to rate changes. A 5-year duration means the value changes approximately 5% for every 1% change in rates.

*Net Interest Income (NII)* — total interest earned minus total interest paid. NII sensitivity analysis answers: how does our spread change when rates move? Why it matters: NII is your primary source of operating income.

*Economic Value of Equity (EVE)* — the net present value of all future balance sheet cash flows. Why it matters: EVE captures long-term rate risk that does not show up in 12-month NII analysis.

*Liquidity Coverage Ratio (LCR)* — high-quality liquid assets divided by projected 30-day net cash outflows. Why it matters: it measures your ability to survive a 30-day liquidity stress event.

Assessment: Explain Duration Gap, NII Sensitivity, EVE, and LCR to a non-technical audience (simulated board member).

**Module 3 — Running Your First Analysis (2 hours)**
Hands-on session with a sample dataset. Export, clean, import, run full suite, generate report. Each participant completes the full workflow independently. Common data quality flags and how to resolve them. Assessment: complete analysis on provided sample data; report reviewed for completeness.

**Module 4 — Interpreting Results (2 hours)**
What each metric means in context. How to identify when a number is concerning vs. merely informational. How to read the stochastic NII distribution — what the 95th percentile loss means for your institution. How to explain results to management and the board. Common misinterpretations and how to avoid them. Assessment: review a sample output with three embedded anomalies; identify and explain each one.

**Module 5 — Board Presentation Mastery (3 hours)**
Building the 8-slide ALM committee deck using CERNIQ data. Calibrating language complexity to the audience. Using CERNIQ's AI-generated narrative as a first draft — what to keep, what to rewrite. Handling board questions about metrics outside policy limits. Presenting trends vs. point-in-time data. Assessment: deliver a 10-minute ALM committee presentation using a sample CERNIQ report.

**Module 6 — Examination Prep (2 hours)**
Understanding what examiners look for in IRR programs. Generating and reviewing the Evidence Package. Responding to common examiner questions about model assumptions. The Examination Response Playbook step-by-step. How to present CERNIQ as your IRR model in examination documentation. Assessment: complete an examination readiness self-assessment using CERNIQ's Regulatory Compliance Checklist.

---

## SECTION 10: THE GLOBAL FINANCE TEAM BENCHMARK

### What World-Class ALM Looks Like

Goldman Sachs and JPMorgan manage interest rate risk through dedicated ALM desks staffed with PhD-level quantitative analysts, purpose-built risk systems, and real-time data feeds. Their core capabilities: daily repricing risk reports, key-rate duration decomposition across the full yield curve, stochastic scenario analysis with tens of thousands of rate paths, comprehensive documentation for the Federal Reserve's examination teams, and board-level reporting that is both technically rigorous and accessible to non-specialists.

The gap between these institutions and a $200M cooperativa or $500M community bank is not conceptual — the same mathematics applies. The gap is access: access to technology, to quantitative expertise, to the time required to maintain complex models. A community institution CFO has five competing priorities for every hour. A Goldman Sachs ALM analyst has one.

CERNIQ is the technology layer that closes this gap.

---

### The Democratization of Institutional-Grade Finance

The thesis behind CERNIQ is straightforward: the 10,000+ community financial institutions in the United States and Latin America collectively hold trillions of dollars in assets and serve millions of members and customers. These institutions are essential infrastructure — they are the lenders who approve the small business loan that the regional bank declined, the cooperativa that offers the mortgage to the family that the commercial bank turned away.

These institutions deserve the same analytical rigor applied to their balance sheets that large banks apply to theirs. Not a simplified, watered-down version — the actual rigor. Monte Carlo simulation. Key-rate duration. Stochastic income analysis. Board-ready reporting that would satisfy an examiner at any institution of any size.

That is what CERNIQ delivers. Not "good enough for a credit union." Institutional-grade.

---

### Why Every CFO in the World Should Demand This

The question a CFO should ask of their technology stack is not "does this tool work?" It is "does this tool give me the information I need to make decisions under uncertainty?" Interest rate risk is, by definition, decision-making under uncertainty. The future rate environment is unknown. The behavior of your depositor base under rate stress is uncertain. The prepayment behavior of your borrowers is probabilistic.

Every CFO who is managing a balance sheet without stochastic scenario analysis, key-rate decomposition, and a complete audit trail is making decisions with less information than is available. That is a choice — and it is the wrong choice when the tool that provides that information costs $599/month.

---

### The Future: AI-Native Finance Operations

CERNIQ's current platform is the foundation. The roadmap — which is already informing the architecture today — is toward AI-native finance operations where CERNIQ functions as the data and analytics layer for all ALM-related decisions.

Near-term: AI-generated board narrative that drafts the written commentary for each quarterly report, calibrated to your institution's policy language and risk appetite. Natural language query: "What would our NII sensitivity be if we added $50M in 5-year fixed-rate mortgages?" answered in real time.

Medium-term: Predictive analytics on non-maturity deposit behavior using institution-specific historical data. Early-warning indicators that flag balance sheet changes likely to cause policy limit breaches before they occur.

Long-term: CERNIQ as the authoritative ALM data record that connects to your core banking system in real time, providing intramonth risk monitoring, automated examination documentation generation, and peer benchmarking against anonymized cohort data from all CERNIQ institutions.

The institutions that establish their ALM data infrastructure now will be positioned to deploy these capabilities as they become available. The institutions that continue with quarterly Excel exports will be perpetually catching up.

---

## SECTION 11: QUICKSTART REFERENCE CARD

### 5-Step Onboarding Sequence

1. **Create account** at app.cerniq.com → select institution type → enter tier
2. **Download import template** from Settings → Import Templates → select your core system
3. **Export and map balance sheet** from your core system using the mapping guide in Section 3
4. **Upload CSV** → resolve any data quality flags → click Run Full Analysis
5. **Generate board report** → review outputs → distribute PDF to ALM committee

---

### Top 10 Modules Every Institution Should Run Every Quarter

| Priority | Module | Primary Metric | Policy Question |
|---|---|---|---|
| 1 | Duration Gap | Duration Gap (years) | Within -1.0 to +3.0 years? |
| 2 | NII Sensitivity (Deterministic) | NII change under +200 bps | Within -15% limit? |
| 3 | EVE Analysis | EVE change under +300 bps | Within -25% limit? |
| 4 | Repricing Gap | 1-year cumulative gap | Within policy bands? |
| 5 | NII Sensitivity (Stochastic) | 99th pct NII loss | Below capital threshold? |
| 6 | Liquidity Coverage Ratio | LCR % | Above 100%? |
| 7 | Key-Rate Duration | Highest KRD tenor | Concentration risk? |
| 8 | NMD Assumptions | Beta, decay validation | Assumptions current? |
| 9 | Stress Testing | Adverse scenario outcomes | Capital adequate under stress? |
| 10 | Board Report | Full 14-page report | Distributed and archived? |

---

### 5 Red Flags That Trigger Immediate Management Action

1. **NII Sensitivity under +200 bps exceeds -15%** — exposure to rising rates is material; review liability repricing and consider FHLB advances or short-term CD promotions
2. **EVE Sensitivity under +300 bps exceeds -25%** — long-duration asset concentration; review mortgage portfolio and evaluate hedging options
3. **Duration Gap outside -1.0 to +3.0 years** — structural imbalance; review new loan and investment activity for corrective direction
4. **LCR below 105%** — liquidity buffer is thin; activate contingency funding plan review, increase FHLB collateral pledging
5. **Any metric outside policy limits for two consecutive quarters** — requires board notification, management action plan, and documentation of regulatory communication intent

---

### SLA Commitments and Emergency Contacts

| Issue Type | Response SLA | Resolution SLA |
|---|---|---|
| Platform outage (P1) | 15 minutes | 4 hours |
| Calculation error (P2) | 2 hours | 24 hours |
| Data import failure (P3) | 4 hours | 8 hours |
| General support (P4) | Next business day | 3 business days |

**Support:** support@cerniq.com | Platform uptime dashboard: status.cerniq.com
**Examination emergency support** (within 48 hours of examination start): exam-support@cerniq.com

---

### The CERNIQ Glossary — 30 Key Terms (EN/ES)

| Term | Español | Definition |
|---|---|---|
| Asset/Liability Management (ALM) | Gestión de Activos y Pasivos | Process of managing risks from mismatches in asset/liability structure |
| Duration | Duración | Weighted average time until cash flows; measures price sensitivity |
| Duration Gap | Brecha de Duración | Difference between asset and liability duration; measures IRR exposure |
| Economic Value of Equity (EVE) | Valor Económico del Patrimonio | Present value of all balance sheet cash flows; long-term rate risk metric |
| Key-Rate Duration | Duración por Punto Clave | Duration measured at specific yield curve tenor points |
| Monte Carlo Simulation | Simulación Monte Carlo | Statistical method using thousands of random scenarios |
| Net Interest Income (NII) | Margen Financiero Neto | Interest earned minus interest paid; primary earnings source |
| NII Sensitivity | Sensibilidad del Margen Financiero | Change in NII under rate scenarios |
| Non-Maturity Deposit (NMD) | Depósito sin Vencimiento Fijo | Deposits with no contractual maturity (savings, checking) |
| NMD Beta | Beta de Depósito | Rate pass-through coefficient for NMDs; how much deposit rate moves with market |
| NMD Decay | Decaimiento de Depósito | Assumed runoff rate for NMD balances over time |
| Parallel Shift | Desplazamiento Paralelo | Yield curve scenario where all tenors move the same amount |
| Bear Steepener | Empinamiento Alcista | Scenario where short rates rise more than long rates |
| Bull Flattener | Aplanamiento Bajista | Scenario where long rates fall more than short rates |
| Rate Shock | Choque de Tasa | Instantaneous large rate movement scenario (e.g., +300 bps) |
| Repricing Gap | Brecha de Reprecio | Difference between assets and liabilities repricing in a given period |
| Liquidity Coverage Ratio (LCR) | Coeficiente de Cobertura de Liquidez | High-quality liquid assets / 30-day net outflows |
| Prepayment Speed | Velocidad de Prepago | Rate at which loans prepay ahead of schedule |
| PSA (Public Securities Association) | PSA | Standard prepayment speed benchmark for mortgages |
| Yield Curve | Curva de Rendimientos | Plot of interest rates across different maturities |
| SOFR | SOFR | Secured Overnight Financing Rate; primary US floating rate benchmark |
| Basis Risk | Riesgo de Base | Risk from imperfect correlation between different interest rate indices |
| Interest Rate Risk (IRR) | Riesgo de Tasa de Interés | Risk of loss due to adverse interest rate movements |
| Model Risk | Riesgo de Modelo | Risk of incorrect decisions due to model errors or misuse |
| Stress Testing | Pruebas de Tensión | Analysis under extreme but plausible adverse scenarios |
| Capital Adequacy | Adecuación de Capital | Sufficiency of capital to absorb potential losses |
| Net Worth Ratio | Ratio de Patrimonio Neto | Net worth as a percentage of total assets |
| Audit Trail | Rastro de Auditoría | Complete record of all calculations and their inputs |
| Evidence Package | Paquete de Evidencias | Documentation set for regulatory examination |
| Policy Limit | Límite de Política | Board-approved maximum/minimum for each risk metric |

---

## APPENDIX: ABOUT CERNIQ

CERNIQ is an ALM reporting platform designed for CFOs, Treasurers, Risk Managers, and Compliance Officers at community financial institutions globally. The platform converts a standard balance sheet CSV upload into a 14-page board-ready ALM report in minutes, replacing $15,000–$40,000 per year in ALM consultant fees while delivering institutional-grade analytical rigor.

CERNIQ currently serves 109 Puerto Rico cooperativas and more than 40 NCUA-regulated credit unions, with active expansion into the 5,000+ US credit union market, Latin American cooperativas, and community banks worldwide. The platform is fully bilingual in English and Spanish.

**Pricing:** $299–$999/month | No per-report fees | No per-user limits
**Trial:** 30-day full-access trial available at app.cerniq.com
**Contact:** info@cerniq.com | enterprise@cerniq.com

---

*CERNIQ Finance Team Adoption Playbook — Version 1.0 — April 2026*
*This document is intended for internal use by finance teams evaluating or implementing CERNIQ.*
*For questions about this document, contact your CERNIQ account team.*
