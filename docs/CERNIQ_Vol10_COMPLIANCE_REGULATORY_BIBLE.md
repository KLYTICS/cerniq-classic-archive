# CERNIQ Vol10 — COMPLIANCE & REGULATORY BIBLE
## The Definitive Compliance, Legal Operations, and Regulatory Alignment Reference
### KLYTICS LLC | CERNIQ ALM Platform | Puerto Rico Cooperativas & Credit Unions

---

**Document Control**

| Field | Value |
|---|---|
| Volume | Vol10 |
| Series | CERNIQ Bible Series |
| Status | AUTHORITATIVE — Production Reference |
| Effective Date | 2026-04-16 |
| Jurisdiction | Puerto Rico, United States Federal |
| Primary Regulator | COSSEC (Cooperativas) / NCUA (Credit Unions) |
| Legal Entity | KLYTICS LLC |
| Platform Version | v1.0.0 |
| Classification | Internal + Customer-Facing Compliance Reference |

---

> **IMPORTANT LEGAL NOTICE / AVISO LEGAL IMPORTANTE**
>
> CERNIQ is an analytical reporting tool. CERNIQ does not constitute legal advice, regulatory counsel, financial advisory services, or fiduciary guidance. All regulatory decisions, policy submissions, examination responses, and capital actions remain the sole responsibility of the licensed financial institution and its qualified personnel. CERNIQ generates data-driven reports to assist board members and management; it does not certify regulatory compliance on behalf of any institution.
>
> CERNIQ es una herramienta de análisis e informes. CERNIQ no constituye asesoramiento legal, asesoría regulatoria, servicios de asesoramiento financiero ni orientación fiduciaria. Todas las decisiones regulatorias, presentaciones de políticas, respuestas a examinaciones y acciones de capital son responsabilidad exclusiva de la institución financiera licenciada y su personal calificado. CERNIQ genera informes basados en datos para asistir a los miembros de la junta directiva y la gerencia; no certifica el cumplimiento regulatorio en nombre de ninguna institución.

---

## TABLE OF CONTENTS

1. [CERNIQ's Compliance Architecture](#1-cerniq-compliance-architecture)
2. [COSSEC Regulatory Framework — Deep Dive](#2-cossec-regulatory-framework)
3. [NCUA Regulatory Framework](#3-ncua-regulatory-framework)
4. [ALM Regulatory Compliance Map — All 62 Modules](#4-alm-regulatory-compliance-map)
5. [COSSEC Examination Prep Suite](#5-cossec-examination-prep-suite)
6. [Data Privacy & Security Compliance](#6-data-privacy--security-compliance)
7. [Financial Data Integrity Standards](#7-financial-data-integrity-standards)
8. [Compliance CLI Agents — C-01 through C-04](#8-compliance-cli-agents)
9. [Legal Operations](#9-legal-operations)
10. [Compliance Calendar](#10-compliance-calendar)
11. [Regulatory Change Management](#11-regulatory-change-management)

---

## 1. CERNIQ COMPLIANCE ARCHITECTURE

### 1.1 CERNIQ as a Tool vs. CERNIQ as a Fiduciary

CERNIQ occupies a precisely defined position in the regulatory stack: it is a **decision-support instrument**, not a decision-maker. This distinction is not semantic — it is the legal and operational foundation on which all CERNIQ customer relationships are built.

**What CERNIQ IS:**
- An automated ALM analytics engine that ingests institution balance sheet data and produces COSSEC-aligned board reports
- A bilingual (Spanish/English) report generation platform producing 14-page board-ready PDFs
- A metric computation engine for Duration Gap, NII Sensitivity, EVE, LCR, NSFR, Deposit Beta, and Capital Adequacy
- A regulatory alignment tool that maps institution data against published COSSEC and NCUA thresholds
- A data steward that processes, stores, and protects institution financial data under defined retention and security policies

**What CERNIQ IS NOT:**
- A licensed financial advisor, investment advisor, or credit counselor under Puerto Rico or federal law
- A fiduciary acting on behalf of cooperative members or depositors
- A regulatory substitute — CERNIQ does not replace the ALM Committee, Board of Directors, or designated compliance officer
- A guarantor of examination outcomes — passing CERNIQ's internal validation does not guarantee a passing COSSEC examination result
- A legal counsel substitute — CERNIQ does not interpret regulatory circulars as binding legal opinions

### 1.2 The Compliance Boundary: What CERNIQ Certifies vs. What It Flags

**CERNIQ Certifies (Internal Quality Gates):**
- Mathematical accuracy of computed metrics (Duration Gap, EVE, NII Sensitivity) within defined model parameters
- Report completeness — all 14 required sections are present and non-null
- Data schema integrity — uploaded CSV matches expected format with no missing required fields
- Decimal precision — all financial calculations use PostgreSQL DECIMAL(20,6) fields, never IEEE 754 floats
- Report immutability — once PDF is generated and stored on Cloudflare R2, the artifact hash is recorded and cannot be silently modified
- Bilingual completeness — Spanish and English sections both populated before report release

**CERNIQ Flags (Advisory Signals, Not Certifications):**
- Metrics that breach COSSEC recommended thresholds (e.g., Duration Gap > 3.0 years flagged RED)
- NII Sensitivity exceeding ±20% under +300bp / -300bp shock scenarios
- EVE decline exceeding 20% under interest rate stress
- Liquidity Coverage Ratio below 100%
- Capital Adequacy Ratio below 10% (well-capitalized threshold)
- Deposit Beta outliers inconsistent with peer-group benchmarks
- Data anomalies: negative balances in asset categories, year-over-year variance > 50% without notation

**CERNIQ Does NOT:**
- Issue binding regulatory opinions
- File reports directly with COSSEC on behalf of institutions (institutions submit; CERNIQ prepares)
- Override ALM policy decisions made by the institution's board

### 1.3 Liability Disclaimer Language

**English:**

> CERNIQ, operated by KLYTICS LLC, provides automated analytical reporting tools for financial institutions. The reports, metrics, scores, and recommendations generated by CERNIQ are provided for informational and decision-support purposes only. KLYTICS LLC makes no representation that the use of CERNIQ's outputs will ensure regulatory compliance with COSSEC, NCUA, or any other regulatory body. KLYTICS LLC expressly disclaims any liability for examination findings, regulatory actions, financial losses, or operational consequences arising from reliance on CERNIQ outputs without independent professional review. All ALM models contain inherent assumptions; institutions are responsible for validating model assumptions against their specific balance sheet characteristics. KLYTICS LLC's maximum liability under any circumstances shall not exceed the total subscription fees paid by the institution in the twelve (12) months preceding the claim.

**Spanish:**

> CERNIQ, operado por KLYTICS LLC, proporciona herramientas automatizadas de informes analíticos para instituciones financieras. Los informes, métricas, puntuaciones y recomendaciones generados por CERNIQ se proporcionan únicamente con fines informativos y de apoyo a la toma de decisiones. KLYTICS LLC no representa que el uso de los resultados de CERNIQ garantizará el cumplimiento regulatorio ante COSSEC, NCUA ni cualquier otro organismo regulador. KLYTICS LLC renuncia expresamente a cualquier responsabilidad por hallazgos de examinación, acciones regulatorias, pérdidas financieras o consecuencias operativas derivadas de la dependencia en los resultados de CERNIQ sin revisión profesional independiente. Todos los modelos de ALM contienen supuestos inherentes; las instituciones son responsables de validar los supuestos del modelo contra las características específicas de su balance. La responsabilidad máxima de KLYTICS LLC bajo cualquier circunstancia no excederá las cuotas de suscripción totales pagadas por la institución en los doce (12) meses anteriores al reclamo.

### 1.4 Data Stewardship Policy

| Data Category | What CERNIQ Holds | Retention Period | Storage Location | Encryption |
|---|---|---|---|---|
| Balance Sheet CSVs | Uploaded institution financial data | 7 years (regulatory minimum) | PostgreSQL 15 (encrypted at rest) | AES-256-GCM |
| Generated PDF Reports | Board-ready ALM reports | 7 years | Cloudflare R2 | AES-256 server-side |
| Audit Logs | Who-changed-what, timestamps | 7 years | PostgreSQL audit tables | AES-256-GCM |
| User PII | Name, email, role within institution | Duration of relationship + 1 year | PostgreSQL (encrypted PII fields) | AES-256-GCM |
| ALM Analysis Results | Computed metrics, scenario outputs | 7 years | PostgreSQL DECIMAL fields | Encrypted at rest |
| Session Tokens | JWT authentication tokens | 24 hours (auto-expire) | Redis (ephemeral) | TLS in transit |
| Webhook Signatures | HMAC-SHA256 event signatures | 30 days (log only) | PostgreSQL | Hashed |

**Data Deletion SLA:** Upon written request from an authorized institution representative, all institution data is purged within 30 calendar days. Deletion is logged with a confirmation receipt delivered to the requesting party.

### 1.5 The "Exam-Ready" Principle

Every CERNIQ output is designed to survive COSSEC examiner scrutiny. This means:

1. **Source Traceability:** Every metric in the report can be traced to the specific input data row that produced it
2. **Methodology Disclosure:** Each computed metric includes a footnote describing the calculation methodology and underlying assumptions
3. **Version Stamping:** Every report includes CERNIQ platform version, calculation date, and data-as-of date
4. **Policy Alignment Notation:** Reports note which COSSEC circular letter each section addresses
5. **Bilingual Completeness:** No section is English-only or Spanish-only; examiners working in either language find complete documentation
6. **Threshold Citations:** When a metric is flagged, the report cites the specific COSSEC threshold reference that triggered the flag

---

## 2. COSSEC REGULATORY FRAMEWORK — DEEP DIVE

### 2.1 COSSEC's Legal Authority

**Corporación para la Supervisión y Seguro de Cooperativas de Puerto Rico (COSSEC)** operates under the authority of **Ley 255-2002 (Ley General de Cooperativas de Puerto Rico)**, as amended. Key statutory provisions:

| Statute | Topic | CERNIQ Relevance |
|---|---|---|
| Ley 255-2002, Art. 8 | COSSEC supervisory authority | All examination compliance |
| Ley 255-2002, Art. 12 | Capital adequacy requirements | Capital module (Modules 57-62) |
| Ley 255-2002, Art. 15 | Liquidity management standards | LCR/NSFR modules (41-48) |
| Ley 255-2002, Art. 18 | ALM policy requirement | IRR policy modules (1-10) |
| Ley 255-2002, Art. 22 | Board reporting requirements | Board report generation |
| Ley 255-2002, Art. 30 | Examination cooperation | Exam-ready output standard |
| Ley 255-2002, Art. 45 | Data recordkeeping | 7-year retention policy |

**Circular Letters Referenced in CERNIQ:**
- **CC-2019-01:** ALM Policy Minimum Requirements for Cooperativas
- **CC-2020-03:** Interest Rate Risk Examination Standards (Post-2020 tightening)
- **CC-2021-02:** Liquidity Risk Management Standards
- **CC-2022-01:** Capital Adequacy Framework Update
- **CC-2023-04:** CAMEL Rating Criteria for Cooperativas
- **CC-2024-02:** Board Governance and ALM Committee Requirements
- **CC-2025-01:** Stress Testing Requirements for Cooperativas with Assets > $50M

### 2.2 Examination Areas — CAMEL Framework for Cooperativas

COSSEC applies a modified CAMEL rating system. CERNIQ maps all 62 modules to these five examination dimensions:

#### C — Capital Adequacy
- **Net Worth Ratio:** Net Worth / Total Assets ≥ 10% (Well-Capitalized), 7-10% (Adequately Capitalized), < 7% (Undercapitalized)
- **Risk-Weighted Capital Ratio (where applicable):** Minimum 8%
- **Prompt Corrective Action Triggers:** < 6% Net Worth = Mandatory Supervisory Action
- **CERNIQ Modules:** 57-62 (Capital Analysis Suite)

#### A — Asset Quality
- **Delinquency Rate:** Loans 60+ days past due / Total Loans ≤ 3% (Satisfactory)
- **Charge-off Rate:** Net Charge-offs / Average Loans ≤ 1% (Satisfactory)
- **Concentration Risk:** Single sector > 25% of loan portfolio triggers enhanced reporting
- **CERNIQ Modules:** 25-32 (Asset Quality Suite)

#### M — Management Quality
- **ALM Policy Completeness:** Must include IRR limits, liquidity targets, board approval documentation
- **Board Meeting Frequency:** ALM review minimum quarterly
- **ALM Committee Composition:** At least one financially qualified member
- **CERNIQ Modules:** Compliance report generation, board minutes templates

#### E — Earnings
- **Return on Assets (ROA):** ≥ 0.50% (Satisfactory), < 0.25% (Needs Improvement)
- **Net Interest Margin (NIM):** Institution-specific benchmark; significant deviation triggers review
- **Operating Efficiency Ratio:** Operating Expenses / Net Revenue ≤ 80% (Satisfactory)
- **CERNIQ Modules:** 33-40 (Earnings Analysis Suite)

#### L — Liquidity
- **Liquidity Coverage Ratio (LCR):** ≥ 100% (HQLA / 30-day net outflows)
- **Net Stable Funding Ratio (NSFR):** ≥ 100% (Available stable funding / Required stable funding)
- **Cash & Liquid Assets / Total Assets:** ≥ 5% (operational minimum)
- **Deposit Concentration:** No single depositor > 10% of total deposits (enhanced monitoring)
- **CERNIQ Modules:** 41-56 (Liquidity Suite)

### 2.3 Interest Rate Risk — Primary COSSEC Focus Area

IRR is the single largest finding category, present in **60%+ of cooperativa examinations** per COSSEC 2023 Annual Report.

**COSSEC IRR Thresholds (CC-2020-03):**

| Metric | Green (Acceptable) | Yellow (Monitor) | Red (Action Required) |
|---|---|---|---|
| Duration Gap | ≤ 1.5 years | 1.5 – 3.0 years | > 3.0 years |
| NII Sensitivity (+300bp) | ≤ 10% change | 10-20% change | > 20% change |
| NII Sensitivity (-300bp) | ≤ 10% change | 10-20% change | > 20% change |
| EVE Change (+300bp) | ≤ 10% decline | 10-20% decline | > 20% decline |
| EVE Change (-300bp) | ≤ 10% decline | 10-20% decline | > 20% decline |
| Repricing Gap (1-year) | ≤ 15% of assets | 15-25% of assets | > 25% of assets |
| Deposit Beta | 0.20 – 0.50 | 0.50 – 0.65 | > 0.65 or < 0.15 |

### 2.4 Top 10 COSSEC Examination Findings and CERNIQ's Response

| Rank | Finding | Frequency | CERNIQ Module Addressing It |
|---|---|---|---|
| 1 | No documented IRR policy or outdated policy | 71% | Module 1 (IRR Policy Validator) |
| 2 | Board not receiving ALM reports quarterly | 64% | Board Report Generator (all) |
| 3 | Duration Gap > 3.0 years with no corrective plan | 60% | Module 5 (Duration Gap) |
| 4 | NII Sensitivity not modeled under ±300bp shocks | 58% | Module 7 (NII Sensitivity) |
| 5 | LCR not calculated or below 100% | 52% | Module 41 (LCR) |
| 6 | No stress testing documentation | 49% | Module 9 (Stress Testing) |
| 7 | Deposit Beta not tracked | 45% | Module 12 (Deposit Beta) |
| 8 | EVE not computed | 43% | Module 8 (EVE) |
| 9 | NSFR not calculated | 40% | Module 42 (NSFR) |
| 10 | ALM Committee meeting minutes not maintained | 38% | Board minutes template + audit log |

### 2.5 COSSEC Submission Requirements

| Requirement | Frequency | Format | Submitted By | CERNIQ Role |
|---|---|---|---|---|
| Quarterly Board ALM Report | Quarterly (30 days post quarter-end) | Board-approved document | Institution | Generates board-ready PDF |
| Annual ALM Policy Review | Annual (before Dec 31) | Updated written policy | Institution | Policy completeness validator |
| IRR Limits Documentation | Annual + upon limit change | Written board resolution | Institution | IRR limits template |
| Liquidity Contingency Funding Plan | Annual | Written plan | Institution | LCR/NSFR supporting data |
| Capital Plan (if undercapitalized) | As required by COSSEC | COSSEC-prescribed format | Institution | Capital module data |
| Examination Response | Within 30 days of findings | Written corrective action plan | Institution | Finding response template |

---

## 3. NCUA REGULATORY FRAMEWORK

### 3.1 NCUA Jurisdiction in Puerto Rico

The **National Credit Union Administration (NCUA)** has federal oversight authority over **federally chartered credit unions** operating in Puerto Rico. Puerto Rico state-chartered cooperativas under COSSEC jurisdiction are NOT subject to NCUA examination (they are subject to COSSEC exclusively under Puerto Rico law). This distinction is critical for CERNIQ's dual-track compliance architecture.

**Jurisdiction Matrix:**

| Institution Type | Primary Regulator | Share Insurance | CERNIQ Profile |
|---|---|---|---|
| PR Cooperativa (state charter) | COSSEC | COSSEC Share Insurance Fund | COSSEC module set |
| Federal Credit Union (PR branch) | NCUA | NCUA Share Insurance Fund (NCUSIF) | NCUA module set |
| State-chartered CR with federal insurance | NCUA (insurance) + PR OFI | NCUSIF | Hybrid module set |

### 3.2 NCUA Letter 12-CU-11: Interest Rate Risk

**NCUA Letter to Credit Unions 12-CU-11** (Supervisory Focus: Interest Rate Risk) established the foundational IRR supervision framework for federally insured credit unions. Key requirements mirrored in CERNIQ:

- Written IRR policy approved by board of directors
- Measurement system appropriate to institution complexity
- Stress testing under minimum ±300bp rate shocks
- Board-level review at least quarterly
- Independent validation of IRR model assumptions
- Net Economic Value (NEV) / EVE as primary long-term IRR measure
- NII Sensitivity as primary short-term IRR measure

**NCUA IRR Thresholds (12-CU-11 + NCUA Examiner's Guide):**

| Metric | Acceptable | Elevated | High Risk |
|---|---|---|---|
| NEV Ratio | > 6% | 4-6% | < 4% |
| NEV Sensitivity (+300bp) | < 15% decline | 15-25% decline | > 25% decline |
| NII Sensitivity (+300bp) | < 15% change | 15-25% change | > 25% change |
| Duration Gap | < 2.0 years | 2.0-4.0 years | > 4.0 years |

### 3.3 NCUA Form 5300 — Call Report ALM Fields

NCUA Form 5300 is the quarterly call report filed by federally insured credit unions. Key ALM-relevant fields that CERNIQ maps:

| Form 5300 Field Code | Field Name | CERNIQ Mapping |
|---|---|---|
| 610 | Total Assets | Balance sheet total assets |
| 619 | Total Loans | Loan portfolio module |
| 620 | Total Investments | Investment portfolio module |
| 650 | Total Shares (deposits) | Deposit repricing module |
| 660 | Total Borrowings | Borrowing repricing module |
| 670 | Net Worth | Capital adequacy module |
| 680 | Net Worth Ratio | Capital ratio module |
| 710 | Net Interest Income (YTD) | NII sensitivity baseline |
| 730 | Average Cost of Funds | Deposit beta computation |
| 740 | Average Yield on Loans | Asset yield module |
| 760 | Interest Rate Risk Score | NCUA IRR composite (C-01 CLI maps to this) |
| 800 | Liquidity Ratio | LCR proxy field |
| 820 | Borrowings / Assets Ratio | Funding concentration module |

**CERNIQ NCUA Sync CLI (C-02)** automates the mapping of Form 5300 API responses to CERNIQ's ALM schema, pre-populating balance sheet inputs for NCUA-supervised credit unions.

### 3.4 NCUA CAMEL vs. COSSEC CAMEL — Key Differences

| Dimension | NCUA Weight | COSSEC Weight | Key Difference |
|---|---|---|---|
| Capital | 20% | 25% | COSSEC places higher weight on capital given cooperative structure |
| Assets | 20% | 20% | Substantially aligned |
| Management | 20% | 20% | NCUA emphasizes IRR governance documentation more heavily |
| Earnings | 20% | 15% | COSSEC allows lower ROA for mission-driven cooperativas |
| Liquidity | 20% | 20% | Aligned; COSSEC adds deposit concentration subfactor |
| Sensitivity (NCUA only) | — (separate "S" rating) | N/A | NCUA uses CAMELS; COSSEC folds IRR into "M" and "L" ratings |

**NCUA uses CAMELS (6 factors)** — the "S" factor is Sensitivity to Market Risk (IRR). COSSEC uses CAMEL (5 factors), folding market risk sensitivity into Management and Liquidity components. CERNIQ generates separate exhibit sections for each framework.

### 3.5 NCUA IRR Policy Minimum Content Requirements

Per NCUA 12-CU-11, an adequate IRR policy must contain:

1. Scope statement (which instruments and risks are covered)
2. Board-approved IRR limits (EVE, NII, Duration Gap with numeric thresholds)
3. Measurement methodology description (static gap, simulation, NEV)
4. Repricing assumptions for non-maturity deposits
5. Prepayment speed assumptions for mortgage-related assets
6. Stress testing frequency (minimum quarterly)
7. Model validation requirements (independent review at least annually)
8. Corrective action triggers and escalation procedures
9. Management reporting requirements and frequency
10. Board review and approval procedures

---

## 4. ALM REGULATORY COMPLIANCE MAP — ALL 62 MODULES

### 4.1 Full Compliance Matrix

The following matrix maps all 62 CERNIQ ALM modules across five regulatory dimensions: regulatory reference, required frequency, report page location, examination finding addressed, and COSSEC/NCUA applicability.

#### Suite A: IRR Policy & Governance (Modules 1-10)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 01 | IRR Policy Validator | CC-2020-03, Art. 18 Ley 255 | Annual | Page 2 | Finding #1 (No IRR Policy) | COSSEC + NCUA |
| 02 | Board Resolution Tracker | CC-2024-02 | Quarterly | Page 2 | Finding #2 (Board not receiving reports) | COSSEC |
| 03 | ALM Committee Charter | CC-2024-02, 12-CU-11 | Annual | Page 2 | Finding #10 (No committee minutes) | COSSEC + NCUA |
| 04 | Model Validation Log | 12-CU-11 Section IV | Annual | Page 14 (Exhibit) | IRR model not validated | NCUA primary |
| 05 | Duration Gap Calculator | CC-2020-03, 12-CU-11 | Quarterly | Page 5 | Finding #3 (Duration Gap > 3yr) | COSSEC + NCUA |
| 06 | Repricing Gap Analysis | CC-2020-03 | Quarterly | Page 5 | Repricing concentration | COSSEC + NCUA |
| 07 | NII Sensitivity (±300bp) | CC-2020-03, 12-CU-11 | Quarterly | Page 6 | Finding #4 (NII not modeled) | COSSEC + NCUA |
| 08 | EVE / NEV Calculator | CC-2020-03, 12-CU-11 | Quarterly | Page 7 | Finding #8 (EVE not computed) | COSSEC + NCUA |
| 09 | Stress Test Engine | CC-2025-01, 12-CU-11 | Quarterly | Page 8 | Finding #6 (No stress testing) | COSSEC + NCUA |
| 10 | IRR Limit Monitor | CC-2020-03 | Monthly | Page 5 | Limit breach not reported | COSSEC + NCUA |

#### Suite B: Balance Sheet Structure (Modules 11-24)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 11 | Asset Repricing Schedule | CC-2020-03 | Quarterly | Page 4 | Asset repricing misclassified | COSSEC + NCUA |
| 12 | Deposit Beta Calculator | CC-2020-03 | Quarterly | Page 9 | Finding #7 (Deposit Beta not tracked) | COSSEC + NCUA |
| 13 | Non-Maturity Deposit Analyzer | 12-CU-11 | Quarterly | Page 9 | NMD assumptions not documented | NCUA primary |
| 14 | Fixed Rate Asset Concentration | CC-2020-03 | Quarterly | Page 4 | Concentration risk in fixed assets | COSSEC |
| 15 | Variable Rate Asset Tracker | CC-2020-03 | Quarterly | Page 4 | Variable rate mismatch | COSSEC + NCUA |
| 16 | Mortgage Portfolio ALM | CC-2020-03, 12-CU-11 | Quarterly | Page 4 | Prepayment assumptions not disclosed | COSSEC + NCUA |
| 17 | Investment Portfolio Classifier | CC-2020-03 | Quarterly | Page 4 | Investment maturity mismatch | COSSEC |
| 18 | Borrowing Repricing Map | CC-2020-03 | Quarterly | Page 4 | FHLB advance repricing ignored | COSSEC |
| 19 | Loan-to-Deposit Ratio | CC-2021-02 | Quarterly | Page 11 | Liquidity risk indicator | COSSEC |
| 20 | Average Life Calculator | CC-2020-03 | Quarterly | Page 5 | Asset liability mismatch | COSSEC + NCUA |
| 21 | Yield Curve Constructor | 12-CU-11 | Quarterly | Page 6 (exhibit) | Model assumption not market-based | NCUA |
| 22 | Forward Rate Simulator | 12-CU-11 | Quarterly | Page 6 | Scenario analysis missing | NCUA |
| 23 | Convexity Estimator | 12-CU-11 | Annual | Page 7 | Advanced IRR not measured | NCUA |
| 24 | Embedded Option Analyzer | 12-CU-11 | Annual | Page 7 | Call/prepayment options not valued | NCUA |

#### Suite C: Asset Quality (Modules 25-32)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 25 | Delinquency Rate Tracker | CC-2023-04 (CAMEL A) | Monthly | Page 10 | Delinquency above peer | COSSEC |
| 26 | Net Charge-off Calculator | CC-2023-04 | Monthly | Page 10 | NCO rate deteriorating | COSSEC |
| 27 | Loan Concentration Monitor | CC-2023-04, CC-2022-01 | Quarterly | Page 10 | Sector concentration > 25% | COSSEC |
| 28 | ALLL/ACL Adequacy Checker | CC-2022-01 | Quarterly | Page 10 | Reserves inadequate | COSSEC |
| 29 | Past Due Aging Report | CC-2023-04 | Monthly | Page 10 | Aging schedule not maintained | COSSEC |
| 30 | Classified Asset Ratio | CC-2023-04 | Quarterly | Page 10 | Classified assets > 10% net worth | COSSEC |
| 31 | CECL Transition Tracker | FASB ASC 326 | Annual | Page 14 | CECL not implemented (>$10M) | COSSEC + NCUA |
| 32 | Credit Risk Stress Tester | CC-2025-01 | Annual | Page 8 | Credit stress not modeled | COSSEC |

#### Suite D: Earnings Analysis (Modules 33-40)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 33 | Return on Assets (ROA) | CC-2023-04 (CAMEL E) | Quarterly | Page 11 | ROA below 0.25% | COSSEC |
| 34 | Net Interest Margin (NIM) | CC-2023-04 | Quarterly | Page 11 | NIM compression trending | COSSEC |
| 35 | Operating Efficiency Ratio | CC-2023-04 | Quarterly | Page 11 | Efficiency ratio > 85% | COSSEC |
| 36 | NII Projection (12-month) | CC-2020-03 | Quarterly | Page 6 | Forward earnings not projected | COSSEC + NCUA |
| 37 | Spread Analysis | CC-2020-03 | Quarterly | Page 11 | Asset-liability spread compression | COSSEC |
| 38 | Non-Interest Income Tracker | CC-2023-04 | Quarterly | Page 11 | Fee income concentration | COSSEC |
| 39 | Pre-Provision Net Revenue | CC-2025-01 | Annual | Page 11 | Earnings stress not tested | COSSEC |
| 40 | Peer Group Benchmarker | CC-2023-04 | Quarterly | Page 12 | Performance vs. peers not evaluated | COSSEC |

#### Suite E: Liquidity Management (Modules 41-56)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 41 | Liquidity Coverage Ratio (LCR) | CC-2021-02, 12-CU-11 | Monthly | Page 13 | Finding #5 (LCR not computed) | COSSEC + NCUA |
| 42 | Net Stable Funding Ratio (NSFR) | CC-2021-02 | Quarterly | Page 13 | Finding #9 (NSFR not computed) | COSSEC + NCUA |
| 43 | Cash Flow Projection (30-day) | CC-2021-02 | Monthly | Page 13 | 30-day stress not modeled | COSSEC |
| 44 | Cash Flow Projection (90-day) | CC-2021-02 | Quarterly | Page 13 | 90-day cash plan not documented | COSSEC |
| 45 | High-Quality Liquid Asset (HQLA) Map | CC-2021-02 | Monthly | Page 13 | HQLA not identified | COSSEC |
| 46 | Contingency Funding Plan (CFP) Validator | CC-2021-02 | Annual | Page 14 | CFP not maintained | COSSEC |
| 47 | Deposit Runoff Stress Test | CC-2021-02, CC-2025-01 | Quarterly | Page 13 | Deposit runoff not modeled | COSSEC |
| 48 | Wholesale Funding Reliance | CC-2021-02 | Quarterly | Page 13 | Wholesale > 30% of liabilities | COSSEC |
| 49 | Funding Concentration Monitor | CC-2021-02 | Monthly | Page 13 | Single funder > 10% | COSSEC |
| 50 | Brokered Deposit Tracker | CC-2021-02 | Quarterly | Page 13 | Brokered deposits not flagged | COSSEC |
| 51 | Available Credit Lines | CC-2021-02 | Quarterly | Page 13 | Credit line utilization | COSSEC |
| 52 | Pledged Asset Tracker | CC-2021-02 | Quarterly | Page 13 | Encumbered assets not tracked | COSSEC |
| 53 | Inter-Cooperative Borrowing | CC-2021-02 | Quarterly | Page 13 | COSSEC network funding not monitored | COSSEC |
| 54 | Seasonal Liquidity Planner | CC-2021-02 | Semi-annual | Page 13 | Seasonal demand not anticipated | COSSEC |
| 55 | Intraday Liquidity Monitor | CC-2021-02 | As-needed | Page 13 | Operational liquidity gaps | COSSEC |
| 56 | Liquidity Stress Score | CC-2021-02 | Quarterly | Page 13 | Composite liquidity not scored | COSSEC |

#### Suite F: Capital Adequacy (Modules 57-62)

| Module | Name | Regulatory Reference | Frequency | Report Page | Exam Finding | Applicability |
|---|---|---|---|---|---|---|
| 57 | Net Worth Ratio Calculator | CC-2022-01, Art. 12 Ley 255 | Monthly | Page 3 | Net worth below 10% | COSSEC |
| 58 | Prompt Corrective Action Monitor | CC-2022-01 | Monthly | Page 3 | PCA triggers not monitored | COSSEC |
| 59 | Capital Growth Projector | CC-2022-01 | Quarterly | Page 3 | Capital plan not maintained | COSSEC |
| 60 | Earnings Retention Analyzer | CC-2022-01 | Quarterly | Page 3 | Dividend policy not sustainable | COSSEC |
| 61 | Risk-Based Capital Estimator | CC-2022-01 | Annual | Page 3 | Risk-weighting not applied | COSSEC |
| 62 | Capital Stress Test | CC-2022-01, CC-2025-01 | Annual | Page 3 | Capital not stress-tested | COSSEC |

---

## 5. COSSEC EXAMINATION PREP SUITE

### 5.1 Self-Assessment Framework — 12 Examination Areas

Rate each area 1-5 (5 = Fully Compliant). CERNIQ auto-scores items with asterisks (*) based on system data.

| # | Examination Area | Score (1-5) | CERNIQ Auto-Score? | Action if < 4 |
|---|---|---|---|---|
| 1 | IRR Policy — Written, Board-approved, current-year* | 1-5 | Yes | Run Module 01; update policy |
| 2 | Duration Gap within limits* | 1-5 | Yes | Run Module 05; review asset mix |
| 3 | NII Sensitivity modeled ±300bp* | 1-5 | Yes | Run Module 07 |
| 4 | EVE computed and within limits* | 1-5 | Yes | Run Module 08 |
| 5 | LCR ≥ 100%* | 1-5 | Yes | Run Module 41 |
| 6 | NSFR ≥ 100%* | 1-5 | Yes | Run Module 42 |
| 7 | Capital Net Worth ≥ 10%* | 1-5 | Yes | Run Module 57 |
| 8 | Board received ALM report last quarter | 1-5 | Partial | Generate and deliver report |
| 9 | Stress testing documented last 12 months* | 1-5 | Yes | Run Module 09 |
| 10 | ALM Committee meeting minutes on file | 1-5 | No | Document minutes using template |
| 11 | Deposit Beta tracked and documented* | 1-5 | Yes | Run Module 12 |
| 12 | Contingency Funding Plan current | 1-5 | No | Update CFP using Module 46 exhibit |

**Composite COSSEC Readiness Score:** Sum of 12 scores / 60 × 100 = Score %

- 90-100%: Exam-ready
- 75-89%: Minor remediation needed (< 30 days)
- 60-74%: Moderate findings likely; corrective action plan required
- Below 60%: Significant deficiencies; engage compliance counsel

### 5.2 Evidence Package Checklist — What COSSEC Examiner Expects

**Documents to Prepare (30-item checklist / Lista de verificación de 30 elementos):**

1. [ ] Current ALM Policy (signed, board-approved, dated this year) / Política ALM actual (firmada, aprobada por la junta, del año en curso)
2. [ ] Last 4 quarters of board ALM reports / Últimos 4 informes ALM de la junta
3. [ ] ALM Committee meeting minutes (last 4 meetings) / Actas del Comité ALM (últimas 4 reuniones)
4. [ ] IRR limits with board resolution approving them / Límites de TIR con resolución de la junta
5. [ ] Duration Gap calculation worksheets (last 4 quarters) / Hojas de cálculo del Duration Gap
6. [ ] NII Sensitivity analysis (±300bp) last 4 quarters / Análisis de sensibilidad NII
7. [ ] EVE analysis last 4 quarters / Análisis EVE últimos 4 trimestres
8. [ ] Stress test results and management response / Resultados de pruebas de estrés
9. [ ] Contingency Funding Plan / Plan de Financiamiento de Contingencia
10. [ ] LCR calculation last 12 months / Cálculo LCR últimos 12 meses
11. [ ] NSFR calculation last 4 quarters / Cálculo NSFR
12. [ ] Deposit Beta history (2 years) / Historial de Beta de Depósitos
13. [ ] Capital plan / Plan de Capital
14. [ ] Net Worth Ratio trend (8 quarters) / Tendencia del Ratio de Capital Neto
15. [ ] Asset quality reports (delinquency, charge-offs) / Informes de calidad de activos
16. [ ] ALLL/ACL methodology document / Metodología de ALLL/ACL
17. [ ] Loan concentration reports / Informes de concentración de préstamos
18. [ ] Organizational chart of ALM function / Organigrama de la función ALM
19. [ ] ALM software description and validation documentation / Descripción y validación del software ALM
20. [ ] Board member financial literacy certifications (if any) / Certificaciones de conocimientos financieros
21. [ ] Risk appetite statement / Declaración de apetito al riesgo
22. [ ] Prior examination findings and corrective actions taken / Hallazgos previos y acciones correctivas
23. [ ] Liquidity contingency funding test (last 2 years) / Prueba del plan de financiamiento de contingencia
24. [ ] Investment policy and investment portfolio schedule / Política de inversiones y cronograma
25. [ ] Borrowing authority and outstanding borrowings schedule / Autoridad de préstamos y cronograma
26. [ ] Vendor management policy (for ALM software) / Política de gestión de proveedores
27. [ ] Data governance policy / Política de gobernanza de datos
28. [ ] Business continuity plan (ALM function) / Plan de continuidad de negocios
29. [ ] Training records for ALM staff / Registros de capacitación
30. [ ] Third-party ALM review (model validation if assets > $50M) / Revisión ALM de terceros

### 5.3 Board Minutes Template — ALM Committee Review

```
ACTAS DE LA REUNIÓN DEL COMITÉ DE ALM
MINUTES OF ALM COMMITTEE MEETING

Cooperativa: _______________________
Fecha / Date: ______________________
Hora / Time: _______________________
Lugar / Location: ___________________

Miembros Presentes / Members Present:
_______________________________________

Quórum: Sí / No

AGENDA:
1. Review of last quarter ALM report (CERNIQ Report #_______)
2. Duration Gap: Current value _____ years (Limit: 3.0 years)
3. NII Sensitivity (+300bp): ____% | (-300bp): ____%
4. EVE Change (+300bp): ____% | (-300bp): ____%
5. LCR: ____% | NSFR: ____%
6. Net Worth Ratio: ____%
7. Stress test results review
8. Policy limit compliance: [ ] Within limits [ ] Breach noted (describe)
9. Management action items

DISCUSSION SUMMARY:
[Board member names and summary of substantive discussion]

RESOLUTIONS / RESOLUCIONES:
[ ] Board accepts ALM report for Q_____ ______
[ ] Board notes the following exceptions: _______________
[ ] Board directs management to: ______________________

Próxima reunión / Next meeting: ___________________

Firma del Secretario / Secretary Signature: _______________
Fecha / Date: __________________________________
```

### 5.4 ALM Policy Minimum Required Content

Per CC-2019-01 and CC-2020-03, a compliant ALM policy must include ALL of the following sections. CERNIQ Module 01 validates completeness against this checklist:

1. **Purpose and Scope** — Which assets, liabilities, and off-balance-sheet items are covered
2. **Governance Structure** — Board responsibility, ALM Committee composition, management role
3. **IRR Measurement Methodology** — Description of tools used (gap analysis, simulation, NEV/EVE)
4. **Interest Rate Risk Limits** — Numeric limits for Duration Gap, NII Sensitivity, EVE (board-approved)
5. **Liquidity Risk Limits** — Minimum LCR, NSFR, cash ratio targets
6. **Capital Adequacy Targets** — Net Worth Ratio minimum target and PCA thresholds
7. **Stress Testing Requirements** — Scenarios tested, frequency, responsible parties
8. **Assumptions Documentation** — Non-maturity deposit repricing, prepayment speeds, deposit beta
9. **Reporting Requirements** — What is reported to board, committee, management; what frequency
10. **Model Validation** — Frequency of independent validation, validation criteria
11. **Corrective Action Procedures** — Steps taken when limits are breached
12. **Policy Review Frequency** — Annual at minimum; updated when conditions change materially

### 5.5 IRR Limits Policy Language (Spanish)

```
POLÍTICA DE LÍMITES DE RIESGO DE TASA DE INTERÉS
[NOMBRE DE LA COOPERATIVA]
Aprobada por la Junta de Directores: ___/___/______

LÍMITES DE RIESGO DE TASA DE INTERÉS

La Junta de Directores de [NOMBRE] establece los siguientes límites para el
riesgo de tasa de interés. Estos límites son aplicables en todo momento y su
incumplimiento requiere notificación inmediata al Presidente de la Junta y al
Comité de ALM.

1. BRECHA DE DURACIÓN (Duration Gap)
   Límite Máximo: 3.0 años
   Nivel de Alerta: 2.0 años
   Frecuencia de Medición: Trimestral

2. SENSIBILIDAD DEL INGRESO NETO POR INTERESES (NII Sensitivity)
   Escenario +300 pb: Cambio máximo de ±20%
   Escenario -300 pb: Cambio máximo de ±20%
   Nivel de Alerta: ±15%
   Frecuencia de Medición: Trimestral

3. VALOR ECONÓMICO DEL CAPITAL (EVE)
   Escenario +300 pb: Reducción máxima del 20%
   Escenario -300 pb: Reducción máxima del 20%
   Nivel de Alerta: 15% de reducción
   Frecuencia de Medición: Trimestral

4. COEFICIENTE DE COBERTURA DE LIQUIDEZ (LCR)
   Mínimo: 100%
   Nivel de Alerta: 110%
   Frecuencia de Medición: Mensual

5. RATIO DE FINANCIACIÓN NETA ESTABLE (NSFR)
   Mínimo: 100%
   Nivel de Alerta: 110%
   Frecuencia de Medición: Trimestral

ACCIONES CORRECTIVAS:
Si cualquier métrica supera su límite, la Gerencia notificará al Comité
de ALM dentro de 5 días hábiles y presentará un plan de acción dentro de
30 días calendario.

Aprobado por: ___________________________
Cargo: _________________________________
Firma: _________________________________
Fecha: _________________________________
```

### 5.6 Examination Finding Response Template

```
[LETTERHEAD / MEMBRETE]

Fecha / Date: ___________________________
Para / To: Oficial de Examinación COSSEC / COSSEC Examining Official
Referencia / Reference: Número de Examinación / Examination Number: _______

RESPUESTA A HALLAZGOS DE EXAMINACIÓN
EXAMINATION FINDINGS RESPONSE

Estimado/a [Nombre del Examinador]:
Dear [Examiner Name]:

En respuesta al informe de examinación recibido el [fecha], con los siguientes
hallazgos, la [Cooperativa] presenta el siguiente plan de acción correctiva:

HALLAZGO #1 / FINDING #1: _____________________________________________

Causa Raíz / Root Cause: ______________________________________________

Acción Correctiva / Corrective Action: ___________________________________

Responsable / Responsible Party: _______________________________________

Fecha de Corrección / Target Completion Date: ____________________________

Evidencia de Corrección / Evidence of Correction: _________________________

[Repita para cada hallazgo / Repeat for each finding]

COMPROMISO / COMMITMENT:
La Junta de Directores de [Cooperativa] confirma su compromiso con el
cumplimiento regulatorio y la implementación de las acciones correctivas
descritas en este documento.

Atentamente / Sincerely,

______________________________
[Nombre / Name]
[Cargo / Title]
[Cooperativa / Institution]
[Teléfono / Phone]
[Email]
```

---

## 6. DATA PRIVACY & SECURITY COMPLIANCE

### 6.1 PR Act 81 — Ley de Privacidad del Negocio Electrónico

**Puerto Rico Act 81 of 2017 (Ley de Privacidad del Negocio Electrónico de Puerto Rico)** governs the collection and processing of personal information by businesses operating in Puerto Rico.

**CERNIQ's Act 81 Compliance Posture:**

| Act 81 Requirement | CERNIQ Implementation | Status |
|---|---|---|
| Privacy notice to data subjects | Privacy policy on platform and in DPA | Implemented |
| Security measures for personal data | AES-256-GCM encryption, TLS 1.3 in transit | Implemented |
| Breach notification (72 hours to affected parties) | Incident response plan + automated alerting | Implemented |
| Right to access personal data | User profile export via API | Implemented |
| Right to deletion (30-day SLA) | Deletion workflow in admin panel | Implemented |
| Prohibition on unauthorized data sharing | No third-party data sharing without DPA | Implemented |
| Security policy documented | This document + internal security policy | Implemented |

**PII Fields Encrypted at Rest (AES-256-GCM):**
- User email addresses
- User full names
- Institution officer names (in reports)
- Phone numbers (where collected)
- IP addresses in audit logs (pseudonymized after 90 days)

**What CERNIQ Does NOT Store:**
- Social Security Numbers
- Individual member account data
- Loan-level personal borrower data
- Credit scores of cooperative members
- Any data subject's financial account numbers

CERNIQ processes **aggregate institutional data** (balance sheet totals, portfolio averages, rate data) — NOT individual member records. This significantly reduces Act 81 risk scope.

### 6.2 GDPR Applicability

GDPR (EU Regulation 2016/679) applies to processing of EU data subjects' personal data. CERNIQ's exposure is limited:

- Puerto Rico cooperativas do not typically serve EU residents
- CERNIQ does not market to EU-based institutions as a primary target
- However, if EU-resident employees of PR cooperativas use the platform, GDPR applies to their personal data (name, email)

**CERNIQ GDPR Controls (Precautionary):**
- Lawful basis: Performance of contract (Article 6(1)(b)) for institutional users
- Data minimization: Only email + name collected for platform access
- Right to erasure: 30-day deletion SLA covers GDPR Article 17
- DPA template available for institutional customers who require it
- Standard Contractual Clauses (SCCs) available upon request for cross-border transfers

### 6.3 CCPA Applicability

California Consumer Privacy Act (CCPA) applies if California-based institutions subscribe to CERNIQ. As CERNIQ expands beyond Puerto Rico to mainland US credit unions, CCPA compliance becomes relevant.

| CCPA Right | CERNIQ Response |
|---|---|
| Right to Know | Privacy policy lists all data collected |
| Right to Delete | 30-day deletion SLA |
| Right to Opt-Out of Sale | CERNIQ does not sell personal data |
| Right to Non-Discrimination | Identical service regardless of rights exercise |
| CCPA Notice at Collection | Displayed at account creation |

### 6.4 Data Retention Policy — Detailed Schedule

| Data Type | Retention Period | Legal Basis | Deletion Method |
|---|---|---|---|
| Balance sheet CSV uploads | 7 years | COSSEC/NCUA recordkeeping requirements | Secure overwrite (DoD 5220.22-M) |
| Generated PDF reports | 7 years | Regulatory examination preparedness | Cloudflare R2 lifecycle policy + secure delete |
| ALM analysis results (DB) | 7 years | Audit trail completeness | PostgreSQL secure delete + vacuum |
| User account data | Relationship duration + 1 year | Contract performance | Hard delete with confirmation |
| Audit logs (updatedAt trails) | 7 years | Regulatory examination | Append-only log with expiry |
| Session tokens | 24 hours | Security (auto-expire) | Redis TTL |
| Webhook event logs | 30 days | Debugging and security | Automatic purge via cron |
| Support tickets / emails | 3 years | Business records | Manual deletion on schedule |

### 6.5 Security Architecture Summary

| Security Control | Technology | Coverage |
|---|---|---|
| Encryption at Rest | AES-256-GCM | All PII fields, all financial data in PostgreSQL |
| Encryption in Transit | TLS 1.3 | All API traffic, database connections, R2 access |
| Content Security Policy | Helmet CSP (NestJS) | All HTTP headers, prevents XSS via header injection |
| XSS Prevention | DOMPurify + input sanitization | All user-supplied string inputs |
| SQL Injection Prevention | Prisma ORM parameterized queries | All database operations |
| Rate Limiting | NestJS rate limiter (express-rate-limit) | All API endpoints: 100 req/min default |
| Webhook Integrity | HMAC-SHA256 signature verification | All inbound webhook events |
| Authentication | JWT + refresh tokens (24h / 7d) | All authenticated endpoints |
| Authorization | RBAC (role-based access control) | Institution-level data isolation |
| Audit Logging | 30 models with updatedAt + application logs | Who-changed-what for all financial data |

### 6.6 Report Storage and Immutability

Generated PDF reports are stored on **Cloudflare R2** with the following controls:

1. **Presigned URLs:** Report access uses time-limited presigned URLs (default: 1-hour expiry); reports are never publicly accessible
2. **Content-Hash Recording:** SHA-256 hash of every generated PDF is stored in PostgreSQL at generation time
3. **Immutability Enforcement:** Once a report is finalized and hash-recorded, the corresponding database row is marked `status: LOCKED`; no updates are permitted via the application layer
4. **Versioning:** If a report must be corrected, a new report version is generated with a new hash; prior versions are archived, not deleted
5. **Access Log:** Every presigned URL generation is logged with user ID, timestamp, and IP address

---

## 7. FINANCIAL DATA INTEGRITY STANDARDS

### 7.1 Decimal Precision — Why Float Is Prohibited

CERNIQ uses **PostgreSQL DECIMAL(20,6)** for all 46 financial calculation fields. This is not arbitrary — it is a regulatory and mathematical requirement.

**The Float Problem:**
IEEE 754 double-precision floating-point numbers cannot represent most decimal fractions exactly. In financial calculations, this causes rounding drift that compounds across iterations:

```
Example: 0.1 + 0.2 in IEEE 754 Float
Expected: 0.3
Actual:   0.30000000000000004

In a $500M asset portfolio NII calculation:
$500,000,000 × 0.30000000000000004 = $150,000,000.02
vs. $500,000,000 × 0.30 = $150,000,000.00
Difference: $0.02 per calculation, compounding across 62 modules
```

For COSSEC examination purposes, NII calculations that produce rounding artifacts inconsistent with the institution's general ledger will trigger data integrity findings.

**CERNIQ's DECIMAL Strategy:**

| Field Category | PostgreSQL Type | Precision | Example Fields |
|---|---|---|---|
| Asset/Liability Balances | DECIMAL(20,2) | Cents-level | total_assets, total_loans, total_deposits |
| Interest Rates | DECIMAL(10,6) | 6 decimal places | asset_yield, cost_of_funds, deposit_beta |
| Ratios and Percentages | DECIMAL(10,6) | 6 decimal places | lcr_ratio, nsfr_ratio, nwratio |
| Duration / Maturity | DECIMAL(10,4) | 4 decimal places | duration_gap, avg_life, repricing_gap |
| EVE / NEV Values | DECIMAL(20,2) | Cents-level | eve_base, eve_shocked, nev_ratio |
| NII Projections | DECIMAL(20,2) | Cents-level | nii_base, nii_shocked_up, nii_shocked_down |

**Total: 46 DECIMAL-typed fields across the ALM schema.** Zero FLOAT fields in financial calculation paths.

### 7.2 Audit Trail Completeness

CERNIQ maintains audit trails across **30 database models**, each with:
- `updatedAt` timestamp (auto-managed by Prisma)
- `updatedBy` user ID (application-layer injection on all mutations)
- `createdAt` timestamp
- `createdBy` user ID

**Models with Full Audit Coverage (30):**

```
1. Institution         11. LiquidityReport    21. AuditLog
2. User               12. CapitalReport       22. ReportVersion
3. BalanceSheet       13. StressTestResult    23. PolicyDocument
4. ALMReport          14. PeerBenchmark       24. ExamFinding
5. IRRAnalysis        15. DepositBeta         25. CorrectiveAction
6. NiiSensitivity     16. DurationGap         26. BoardMinutes
7. EveAnalysis        17. RepricingSchedule   27. ComplianceScore
8. LcrCalculation     18. AssetQualityReport  28. NotificationLog
9. NsfrCalculation    19. EarningsReport      29. WebhookEvent
10. CapitalPlan       20. CashFlowProjection  30. DataImport
```

### 7.3 Database Constraints Summary

**Cascade Delete Rules (8):**
1. Institution → ALMReport (CASCADE: delete all reports when institution deleted)
2. Institution → User (CASCADE: delete all users when institution deleted)
3. ALMReport → IRRAnalysis (CASCADE)
4. ALMReport → NiiSensitivity (CASCADE)
5. ALMReport → EveAnalysis (CASCADE)
6. ALMReport → LcrCalculation (CASCADE)
7. ALMReport → NsfrCalculation (CASCADE)
8. BalanceSheet → ALMReport (RESTRICT: cannot delete balance sheet if reports depend on it)

**Unique Constraints (3 on natural keys):**
1. `Institution.cossecId` — COSSEC registration number is unique per institution
2. `BalanceSheet.(institutionId, reportingDate)` — One balance sheet per institution per quarter
3. `ALMReport.(institutionId, reportingPeriod, reportType)` — No duplicate reports per period

**Database Indexes (38 total):**
- 12 indexes on foreign keys (join performance)
- 8 indexes on date fields (time-series queries)
- 6 composite indexes on (institutionId + date) pairs
- 5 indexes on status/type enums (report filtering)
- 4 indexes on computed metric fields (threshold monitoring queries)
- 3 partial indexes on active records only (performance at scale)

---

## 8. COMPLIANCE CLI AGENTS

### C-01: COSSEC Validator CLI

**Purpose:** Validates a completed CERNIQ ALM report against all COSSEC regulatory thresholds and produces a compliance score, findings list, and corrective action recommendations.

**Full Master Prompt:**

```
COSSEC VALIDATOR CLI — CERNIQ COMPLIANCE AGENT C-01
Version: 1.0.0 | Platform: CERNIQ v1.0.0
Regulatory Reference: CC-2020-03, CC-2021-02, CC-2022-01, CC-2023-04, CC-2025-01

IDENTITY:
You are the COSSEC Validator, a compliance analysis agent for CERNIQ's ALM
reporting platform. Your role is to evaluate completed ALM report data against
COSSEC regulatory thresholds and produce a structured compliance assessment.
You operate in a financial regulatory context. You are precise, citation-based,
and produce actionable findings. You do not speculate; you report based on data.

INPUT CONTRACT:
You will receive a JSON object with the following structure:
{
  "institutionId": "string",
  "institutionName": "string",
  "reportingPeriod": "YYYY-QN",
  "reportId": "string",
  "metrics": {
    "durationGap": number,           // in years
    "niiSensitivityUp300": number,   // % change (positive = increase)
    "niiSensitivityDown300": number, // % change (negative = decrease)
    "eveChangeUp300": number,        // % change (negative = decline)
    "eveChangeDown300": number,      // % change (negative = decline)
    "lcr": number,                   // as % (100 = 100%)
    "nsfr": number,                  // as %
    "netWorthRatio": number,         // as %
    "roa": number,                   // as %
    "nim": number,                   // as %
    "delinquencyRate": number,       // as %
    "chargeOffRate": number,         // as %
    "depositBeta": number,           // decimal (0.35 = 35%)
    "repricingGap1yr": number,       // as % of assets
    "efficiencyRatio": number        // as %
  },
  "policyOnFile": boolean,
  "boardReportDeliveredThisQuarter": boolean,
  "stressTestCompleted": boolean,
  "cfpCurrent": boolean,
  "almCommitteeMinutesOnFile": boolean
}

VALIDATION RULES — apply each rule against the data above:

RULE SET 1: IRR METRICS
R1.1: durationGap > 3.0 → CRITICAL FINDING "Duration Gap exceeds COSSEC limit of 3.0 years" [CC-2020-03]
R1.2: durationGap > 2.0 → WARNING "Duration Gap in monitoring zone (2.0-3.0 years)" [CC-2020-03]
R1.3: abs(niiSensitivityUp300) > 20 → CRITICAL "NII Sensitivity (+300bp) exceeds 20% COSSEC threshold" [CC-2020-03]
R1.4: abs(niiSensitivityDown300) > 20 → CRITICAL "NII Sensitivity (-300bp) exceeds 20% COSSEC threshold" [CC-2020-03]
R1.5: abs(niiSensitivityUp300) > 15 → WARNING "NII Sensitivity in elevated zone" [CC-2020-03]
R1.6: eveChangeUp300 < -20 → CRITICAL "EVE decline (+300bp shock) exceeds COSSEC 20% limit" [CC-2020-03]
R1.7: eveChangeDown300 < -20 → CRITICAL "EVE decline (-300bp shock) exceeds COSSEC 20% limit" [CC-2020-03]
R1.8: abs(repricingGap1yr) > 25 → CRITICAL "1-year repricing gap exceeds 25% of assets" [CC-2020-03]
R1.9: depositBeta > 0.65 OR depositBeta < 0.15 → WARNING "Deposit Beta outside normal range" [CC-2020-03]

RULE SET 2: LIQUIDITY METRICS
R2.1: lcr < 100 → CRITICAL "LCR below 100% minimum" [CC-2021-02]
R2.2: lcr < 110 → WARNING "LCR in monitoring zone (100-110%)" [CC-2021-02]
R2.3: nsfr < 100 → CRITICAL "NSFR below 100% minimum" [CC-2021-02]
R2.4: nsfr < 110 → WARNING "NSFR in monitoring zone" [CC-2021-02]

RULE SET 3: CAPITAL METRICS
R3.1: netWorthRatio < 7 → CRITICAL "Net Worth Ratio below adequately capitalized threshold of 7%" [CC-2022-01]
R3.2: netWorthRatio < 10 → WARNING "Net Worth Ratio below well-capitalized threshold of 10%" [CC-2022-01]

RULE SET 4: EARNINGS METRICS
R4.1: roa < 0.25 → WARNING "ROA below acceptable minimum of 0.25%" [CC-2023-04]
R4.2: efficiencyRatio > 85 → WARNING "Efficiency ratio above 85% threshold" [CC-2023-04]

RULE SET 5: ASSET QUALITY
R5.1: delinquencyRate > 5 → CRITICAL "Delinquency rate exceeds 5% threshold" [CC-2023-04]
R5.2: delinquencyRate > 3 → WARNING "Delinquency rate in elevated zone (3-5%)" [CC-2023-04]
R5.3: chargeOffRate > 1.5 → CRITICAL "Charge-off rate exceeds 1.5% threshold" [CC-2023-04]
R5.4: chargeOffRate > 1.0 → WARNING "Charge-off rate in elevated zone (1-1.5%)" [CC-2023-04]

RULE SET 6: GOVERNANCE
R6.1: policyOnFile === false → CRITICAL "No ALM policy on file — required by CC-2019-01" [CC-2019-01]
R6.2: boardReportDeliveredThisQuarter === false → CRITICAL "Board ALM report not delivered this quarter" [CC-2024-02]
R6.3: stressTestCompleted === false → WARNING "Stress test not documented" [CC-2025-01]
R6.4: cfpCurrent === false → WARNING "Contingency Funding Plan not current" [CC-2021-02]
R6.5: almCommitteeMinutesOnFile === false → WARNING "ALM Committee minutes not on file" [CC-2024-02]

SCORING ALGORITHM:
- Start at 100 points
- Each CRITICAL finding: -15 points
- Each WARNING finding: -5 points
- Minimum score: 0

OUTPUT FORMAT:
Produce a JSON response:
{
  "reportId": "input reportId",
  "institutionName": "input institutionName",
  "reportingPeriod": "input reportingPeriod",
  "validationTimestamp": "ISO 8601 timestamp",
  "complianceScore": number (0-100),
  "ratingLabel": "COMPLIANT | MONITOR | DEFICIENT | CRITICAL",
  "criticalFindings": [
    {
      "ruleId": "R1.1",
      "description": "human-readable finding",
      "regulatoryReference": "CC-XXXX-XX",
      "metricValue": number,
      "threshold": number,
      "correctiveAction": "specific actionable step"
    }
  ],
  "warnings": [...same structure...],
  "passedChecks": [...list of rule IDs that passed...],
  "cossecComplianceStatus": "PASS | FAIL",
  "recommendedActions": ["action 1", "action 2", ...]
}

RATING LABELS:
- 90-100: COMPLIANT
- 75-89: MONITOR
- 60-74: DEFICIENT
- 0-59: CRITICAL

After generating JSON output, update the report record in the CERNIQ database:
SET cossecValidationScore = complianceScore,
    cossecValidationStatus = cossecComplianceStatus,
    cossecValidatedAt = NOW(),
    cossecValidationDetails = [JSON output]
WHERE reportId = input.reportId

IMPORTANT: A report marked cossecComplianceStatus = 'FAIL' MUST NOT be
delivered to the board as a finalized report. Flag for management review first.
```

---

### C-02: NCUA Sync CLI

**Purpose:** Ingests NCUA Form 5300 API response data and maps it to CERNIQ's ALM input schema, pre-populating balance sheet fields for NCUA-supervised credit unions.

**Full Master Prompt:**

```
NCUA SYNC CLI — CERNIQ COMPLIANCE AGENT C-02
Version: 1.0.0 | Platform: CERNIQ v1.0.0
Regulatory Reference: NCUA Form 5300, 12-CU-11

IDENTITY:
You are the NCUA Sync Agent, responsible for ingesting NCUA Form 5300 quarterly
call report data from the NCUA public API and mapping it to CERNIQ's ALM input
schema. You handle field transformations, missing-field logic, and data quality
flags. You are a data pipeline agent; you do not interpret regulatory compliance
— that is C-01's responsibility.

INPUT CONTRACT:
You will receive either:
(a) A direct JSON response from the NCUA NCUA Data API (https://ncua.gov/analysis/credit-union-resources-expansion/regulatory-reporting/call-report-data) for a specific credit union and quarter, OR
(b) A manual CSV upload formatted as NCUA 5300 export

FIELD MAPPING TABLE:
Map NCUA Form 5300 fields to CERNIQ BalanceSheet schema:

NCUA Field → CERNIQ Field
610 (Total Assets) → balanceSheet.totalAssets
619 (Total Loans & Leases) → balanceSheet.totalLoans
620 (Total Investments) → balanceSheet.totalInvestments
621 (Cash & Cash Equivalents) → balanceSheet.cashAndEquivalents
630 (Other Assets) → balanceSheet.otherAssets
650 (Total Shares & Deposits) → balanceSheet.totalDeposits
660 (Total Borrowings) → balanceSheet.totalBorrowings
665 (Other Liabilities) → balanceSheet.otherLiabilities
670 (Total Net Worth) → balanceSheet.netWorth
680 (Net Worth Ratio %) → computed: netWorth / totalAssets (validate against reported)
710 (Net Interest Income YTD) → earnings.netInterestIncome
720 (Non-Interest Income YTD) → earnings.nonInterestIncome
730 (Average Cost of Funds %) → irrInputs.avgCostOfFunds
740 (Average Yield on Loans %) → irrInputs.avgLoanYield
760 (Interest Rate Risk Score) → irrInputs.ncuaIrrScore
800 (Liquidity Ratio %) → liquidityInputs.liquidityRatio
820 (Borrowings / Assets %) → liquidityInputs.borrowingsToAssets
840 (Delinquent Loans %) → assetQuality.delinquencyRate
850 (Net Charge-offs %) → assetQuality.chargeOffRate

TRANSFORMATION RULES:
T1: All dollar amounts in NCUA API are in thousands; multiply by 1000 before storing in CERNIQ
T2: All percentages in NCUA API are expressed as whole numbers (e.g., 8.5 = 8.5%); convert to decimal for ratio fields (8.5 → 0.085) where CERNIQ expects decimal format
T3: YTD figures need annualization if reporting period is not Q4: multiply by (4 / reportingQuarter)
T4: If reportingQuarter = 4, use full-year figure as-is

MISSING FIELD HANDLING:
If any of the following fields are null or missing in the API response:
- Log: "WARNING: Field [fieldCode] not present in 5300 response for [cuName] [period]"
- Set CERNIQ field to null with a flag: requiresManualEntry = true
- Do NOT attempt to estimate or fill missing fields
- Required fields (report cannot proceed without them): 610, 650, 670, 619
- Optional fields: all others; report can proceed with nulls flagged

CHANGED FIELD NAMES:
NCUA periodically revises Form 5300 field codes. If an expected field code
returns no data, attempt the following fallback lookups:
- For field 760 (IRR Score): if not found, check field 762 and 758
- For field 730 (Cost of Funds): if not found, compute from available income and average liability data with note
- Log all fallback resolutions: "INFO: Used fallback mapping [old_code] → [new_code]"

VALIDATION AFTER MAPPING:
V1: totalAssets = totalLoans + totalInvestments + cashAndEquivalents + otherAssets (allow ±1% tolerance)
V2: totalAssets = totalDeposits + totalBorrowings + otherLiabilities + netWorth (allow ±1% tolerance)
V3: netWorthRatio = netWorth / totalAssets (validate computed vs. reported; flag if > 0.5% discrepancy)
V4: All required fields must be positive numbers (no negative assets)

OUTPUT FORMAT:
{
  "syncId": "uuid",
  "institutionId": "CERNIQ institution ID",
  "ncuaCharterNumber": "string",
  "reportingPeriod": "YYYY-QN",
  "syncTimestamp": "ISO 8601",
  "status": "COMPLETE | PARTIAL | FAILED",
  "fieldsPopulated": number,
  "fieldsFailed": number,
  "fieldsRequiringManualEntry": ["field names"],
  "validationResults": {
    "balanceSheetBalances": "PASS | FAIL | WARN",
    "requiredFieldsPresent": "PASS | FAIL",
    "dataQualityIssues": ["list of issues"]
  },
  "mappedData": {
    // CERNIQ BalanceSheet schema, populated
  },
  "fallbackResolutions": ["list of fallback mappings used"],
  "warnings": ["list of non-critical issues"],
  "errors": ["list of blocking errors"]
}

Write mappedData to CERNIQ BalanceSheet table only if status = "COMPLETE" or "PARTIAL" with no blocking errors.
For PARTIAL status, set requiresManualReview = true on the BalanceSheet record.
```

---

### C-03: Audit Log Reviewer CLI

**Purpose:** Analyzes PostgreSQL audit trail data and application logs to detect anomalies, unauthorized access patterns, and data integrity violations. Produces daily compliance summaries.

**Full Master Prompt:**

```
AUDIT LOG REVIEWER CLI — CERNIQ COMPLIANCE AGENT C-03
Version: 1.0.0 | Platform: CERNIQ v1.0.0
Regulatory Reference: PR Act 81, COSSEC CC-2023-04 (data governance)

IDENTITY:
You are the Audit Log Reviewer, a security and compliance monitoring agent.
Your role is to analyze CERNIQ's audit trails for integrity violations,
unauthorized access, anomalous patterns, and data quality events. You produce
a daily summary report and flag events requiring human review. You are
evidence-based; you do not accuse — you document and escalate.

INPUT CONTRACT:
You receive a JSON payload representing the last 24 hours of audit events:
{
  "reportDate": "YYYY-MM-DD",
  "auditWindow": "24h",
  "events": [
    {
      "eventId": "uuid",
      "timestamp": "ISO 8601",
      "userId": "uuid or SYSTEM",
      "userEmail": "string",
      "userRole": "ADMIN | ANALYST | VIEWER | SYSTEM",
      "institutionId": "uuid",
      "action": "CREATE | UPDATE | DELETE | READ | LOGIN | EXPORT",
      "model": "model name (from list of 30)",
      "recordId": "uuid",
      "changedFields": ["field names"],
      "previousValues": {object},
      "newValues": {object},
      "ipAddress": "string",
      "userAgent": "string",
      "resultStatus": "SUCCESS | FAILED | BLOCKED"
    }
  ],
  "loginAttempts": [...],
  "apiCallVolume": {by endpoint},
  "reportGenerations": [...],
  "dataExports": [...]
}

ANOMALY DETECTION RULES:

RULE A1 — Unauthorized Field Modification:
Flag if: Financial calculation fields (any DECIMAL field) were modified by a
user with role VIEWER. VIEWER role should be read-only.
Severity: HIGH

RULE A2 — Off-Hours Access:
Flag if: UPDATE or DELETE actions occurred between 11pm-5am AST on non-holiday
weekdays, or on any weekend. (Reference: institution business hours)
Severity: MEDIUM (requires human review; may be legitimate)

RULE A3 — Bulk Record Modification:
Flag if: A single userId performed > 50 UPDATE actions within a 1-hour window.
Severity: HIGH (potential bulk data manipulation)

RULE A4 — Report Modification After Lock:
Flag if: Any UPDATE action targeted a report record with status = LOCKED.
Severity: CRITICAL (report immutability violation)

RULE A5 — Cross-Institution Data Access:
Flag if: A userId associated with institutionId A performed READ actions on
records belonging to institutionId B. Data isolation violation.
Severity: CRITICAL

RULE A6 — Failed Login Surge:
Flag if: Any userId or IP address had > 5 failed login attempts within 15
minutes. Potential brute force attack.
Severity: HIGH

RULE A7 — Cascade Delete Execution:
Flag all DELETE events as requiring manager acknowledgment. Deletions are
logged but not necessarily anomalous — requires human sign-off.
Severity: MEDIUM

RULE A8 — System Account Behavior Change:
Flag if: The SYSTEM account performed any action other than: CREATE (report
records), UPDATE (updatedAt fields), CREATE (audit log entries).
Severity: HIGH

RULE A9 — Data Export Volume Anomaly:
Flag if: Any single session exported > 10 reports or > 5 CSV files within 1
hour. Potential data exfiltration attempt.
Severity: HIGH

RULE A10 — Decimal Field Precision Anomaly:
Flag if: Any financial DECIMAL field was updated to a value with more than 6
decimal places (floating-point contamination detection).
Severity: MEDIUM

OUTPUT FORMAT:
{
  "summaryDate": "YYYY-MM-DD",
  "totalEventsAnalyzed": number,
  "criticalAlerts": [
    {
      "ruleId": "A1-A10",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "eventIds": ["affected event IDs"],
      "userId": "string",
      "institutionId": "string",
      "description": "detailed description",
      "evidenceLog": {object},
      "recommendedAction": "string",
      "requiresHumanReview": true
    }
  ],
  "warnings": [...same structure...],
  "informationalItems": [...],
  "healthSummary": {
    "totalLogins": number,
    "failedLogins": number,
    "reportsGenerated": number,
    "recordsUpdated": number,
    "recordsDeleted": number,
    "dataExports": number,
    "anomalyRate": "X events flagged / Y total events"
  },
  "nextReviewRecommendation": "string"
}

Deliver output to:
1. CERNIQ admin dashboard (in-app alert)
2. security@klytics.co (email digest if any CRITICAL or HIGH alerts)
3. Write summary to AuditLog table with type=DAILY_REVIEW_SUMMARY

For CRITICAL alerts: also trigger webhook to on-call security responder.
```

---

### C-04: Regulatory Report Generator CLI

**Purpose:** Generates bilingual board-ready regulatory narrative sections from completed ALM analysis data, producing the 14-page COSSEC-compliant PDF report.

**Full Master Prompt:**

```
REGULATORY REPORT GENERATOR CLI — CERNIQ COMPLIANCE AGENT C-04
Version: 1.0.0 | Platform: CERNIQ v1.0.0
Regulatory Reference: All COSSEC circulars, Ley 255-2002

IDENTITY:
You are the Regulatory Report Generator, responsible for producing the
bilingual (Spanish/English) ALM board report that is the core deliverable of
the CERNIQ platform. You receive structured ALM analysis results and generate
professional, exam-ready regulatory narrative. You write with precision,
regulatory citation fluency, and bilingual clarity. You do not editorialize —
you present data, context, and COSSEC-referenced conclusions.

PREREQUISITE GATE:
Before generating any report, verify:
CHECK: Has C-01 COSSEC Validator been run on this report data?
IF: cossecValidationStatus IS NULL → ABORT with error "C-01 validation required before report generation"
IF: cossecComplianceStatus = "FAIL" → ABORT with error "Cannot generate board report: COSSEC validation failed. Resolve [criticalFindings list] before proceeding. Management review required."
IF: cossecComplianceStatus = "PASS" → PROCEED

INPUT CONTRACT:
{
  "institutionId": "uuid",
  "institutionName": "string (Spanish legal name)",
  "reportingPeriod": "YYYY-QN",
  "preparedBy": "string (analyst name)",
  "approvedBy": "string (CFO / ALM officer name)",
  "cossecValidationScore": number,
  "metrics": {complete ALM metrics object — all 62 module outputs},
  "peerBenchmarks": {median/percentile data for comparable cooperativas},
  "priorPeriodMetrics": {same structure, prior quarter},
  "institutionBackground": {
    "totalAssets": number,
    "charterYear": number,
    "memberCount": number,
    "primaryMarket": "string"
  },
  "managementNarrative": "string (optional: management commentary to include)"
}

REPORT STRUCTURE (14 pages — generate each section in both EN and ES):

PAGE 1 — COVER PAGE
- Institution name (Spanish legal name)
- Report title: "Informe de Gestión de Activos y Pasivos / Asset-Liability Management Report"
- Reporting period
- Prepared by / Reviewed by / Approved by
- CERNIQ platform version + generation timestamp
- COSSEC compliance score badge (numeric)
- Disclaimer (use standard KLYTICS disclaimer)

PAGE 2 — EXECUTIVE SUMMARY (bilingual)
- 3-paragraph summary: institution overview, key ALM highlights, overall risk posture
- Traffic-light table: 6 key metrics (Duration Gap, NII, EVE, LCR, NWR, ROA) with status colors
- Quarter-over-quarter change summary
- Reference: CC-2024-02

PAGE 3 — CAPITAL ADEQUACY (bilingual)
- Net Worth Ratio: current + trend (8 quarters)
- PCA status statement
- Capital growth rate
- Dividend sustainability analysis
- Risk-based capital estimate
- Reference: CC-2022-01, Art. 12 Ley 255

PAGE 4 — BALANCE SHEET STRUCTURE & REPRICING (bilingual)
- Asset mix breakdown (loans, investments, cash, other)
- Liability mix breakdown (deposits, borrowings, other)
- Repricing schedule (< 1yr, 1-3yr, 3-5yr, 5yr+)
- Fixed vs. variable rate split
- Reference: CC-2020-03

PAGE 5 — INTEREST RATE RISK OVERVIEW (bilingual)
- Duration Gap analysis + interpretation
- 1-year repricing gap
- IRR limit compliance table
- Trend analysis (4 quarters)
- Reference: CC-2020-03

PAGE 6 — NII SENSITIVITY ANALYSIS (bilingual)
- NII under 6 rate scenarios: -300bp, -200bp, -100bp, Base, +100bp, +200bp, +300bp
- Table format: NII amount + % change from base for each scenario
- Management interpretation of highest-impact scenario
- Reference: CC-2020-03, 12-CU-11

PAGE 7 — EVE / ECONOMIC VALUE ANALYSIS (bilingual)
- EVE under same 6 rate scenarios
- EVE as % of assets under each scenario
- Post-shock EVE adequacy assessment
- Reference: CC-2020-03, 12-CU-11

PAGE 8 — STRESS TESTING RESULTS (bilingual)
- Combined rate + credit stress scenario
- Liquidity stress scenario (deposit runoff)
- Capital stress result
- Management response to stress outcomes
- Reference: CC-2025-01

PAGE 9 — DEPOSIT ANALYSIS (bilingual)
- Deposit mix (share drafts, regular shares, certificates, IRAs, business)
- Non-maturity deposit repricing assumptions + justification
- Deposit Beta calculation + interpretation
- Deposit concentration analysis
- Reference: CC-2020-03, CC-2021-02

PAGE 10 — ASSET QUALITY (bilingual)
- Delinquency rate + trend
- Net charge-off rate + trend
- Classified asset ratio
- Loan concentration by sector
- ALLL/ACL adequacy assessment
- Reference: CC-2023-04

PAGE 11 — EARNINGS ANALYSIS (bilingual)
- ROA vs. prior periods + peer median
- NIM analysis
- Operating efficiency ratio
- NII projection (forward 12 months)
- Peer benchmark comparison
- Reference: CC-2023-04

PAGE 12 — PEER BENCHMARKING (bilingual)
- Comparison table: institution vs. PR cooperativa peer group (similar asset size)
- Metrics: ROA, NIM, NWR, delinquency, LCR, Duration Gap
- Percentile ranking for each metric
- Strategic observations
- Reference: CC-2023-04

PAGE 13 — LIQUIDITY MANAGEMENT (bilingual)
- LCR calculation + waterfall
- NSFR calculation + detail
- Cash flow projections (30-day, 90-day)
- Funding concentration analysis
- Contingency funding plan status
- Reference: CC-2021-02

PAGE 14 — REGULATORY EXHIBITS & CERTIFICATIONS (bilingual)
- Complete IRR limit compliance attestation
- Model assumptions disclosure (NMD repricing, prepayment speeds, deposit beta)
- COSSEC validation score and detail (from C-01)
- Report immutability hash
- Management certification signature block
- Reference: CC-2019-01, CC-2020-03

WRITING STANDARDS:
- Professional, board-appropriate tone in both languages
- Spanish: use Puerto Rico Spanish conventions, regulatory terminology consistent with COSSEC circular letters
- English: use US credit union / banking regulatory conventions
- No speculation or prediction language (use: "based on current balance sheet structure" not "will likely")
- Always cite COSSEC circular when making a threshold-based statement
- Data tables: always include prior-quarter comparison column
- Flag every metric that is in WARNING or CRITICAL zone with [REQUIERE ATENCIÓN / REQUIRES ATTENTION] notation

QUALITY GATE — OUTPUT VALIDATION:
Before marking report as COMPLETE, verify:
□ All 14 pages have content (no null sections)
□ All metrics referenced in text match the input metrics object
□ Both ES and EN sections present on every page
□ At least one COSSEC circular reference per page
□ Report generation timestamp and platform version included
□ Management certification block present on Page 14
□ COSSEC validation score matches C-01 output

IF all 14 items checked: mark report status = COMPLETE, generate PDF, store on R2, record SHA-256 hash.
IF any item fails: mark report status = DRAFT, log failed checks, do not generate PDF.
```

---

## 9. LEGAL OPERATIONS

### 9.1 Terms of Service — Key Clauses

**Section 3: Nature of Service**
CERNIQ is an analytical software platform. Nothing in CERNIQ's outputs constitutes legal advice, investment advice, financial advisory services, or representation before any regulatory authority. KLYTICS LLC is not a licensed financial institution, credit union service organization (CUSO), or registered investment advisor.

**Section 5: Institution Responsibility**
The subscribing institution remains solely responsible for: (a) the accuracy of data uploaded to CERNIQ; (b) all regulatory submissions made using CERNIQ outputs; (c) all ALM policy decisions made by the institution's board; (d) all examination responses submitted to COSSEC or NCUA.

**Section 7: Limitation of Liability**
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KLYTICS LLC'S TOTAL LIABILITY ARISING FROM OR RELATED TO CERNIQ SHALL NOT EXCEED THE TOTAL SUBSCRIPTION FEES PAID BY CUSTOMER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM. KLYTICS LLC SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES.

**Section 9: Data Processing**
Customer grants KLYTICS LLC a limited, non-exclusive license to process customer data solely for the purpose of providing CERNIQ services. KLYTICS LLC shall not use customer data for any other purpose, including benchmarking without aggregation and anonymization.

**Section 11: Regulatory Changes**
KLYTICS LLC will use commercially reasonable efforts to update CERNIQ's compliance thresholds when COSSEC or NCUA publishes new standards. However, KLYTICS LLC does not guarantee real-time regulatory compliance and institutions must verify that CERNIQ reflects current standards before regulatory submissions.

### 9.2 Data Processing Agreement (DPA) Template Structure

A complete DPA with each institutional customer must include:

1. **Definitions:** Data Controller (Institution), Data Processor (KLYTICS LLC), Personal Data, Processing
2. **Subject Matter and Duration:** ALM reporting services; duration of subscription agreement
3. **Nature and Purpose of Processing:** Balance sheet data analytics, report generation
4. **Types of Personal Data:** User names, emails, institution officer names in reports
5. **Categories of Data Subjects:** Institution employees using CERNIQ
6. **Processor Obligations:** Process only per documented instructions; security measures; confidentiality; subprocessor agreements
7. **Subprocessors:** Cloudflare (R2 storage), email delivery provider, infrastructure hosting
8. **Data Subject Rights Support:** KLYTICS assists controller in fulfilling deletion, access, portability requests
9. **Security Measures:** AES-256-GCM, TLS 1.3, access controls, audit logging (per Section 6 of this document)
10. **Breach Notification:** KLYTICS notifies institution within 72 hours of confirmed breach affecting institution data
11. **Data Return / Deletion:** Upon termination, KLYTICS deletes all institution data within 30 days or returns per institution request
12. **Audit Rights:** Institution may audit KLYTICS's compliance with DPA up to once per year with 30-day notice

### 9.3 Legal Entity Structure

**KLYTICS LLC** is the operating legal entity for CERNIQ.

| Item | Detail |
|---|---|
| Legal Name | KLYTICS LLC |
| Product | CERNIQ ALM Platform |
| Jurisdiction | Puerto Rico / United States |
| Entity Type | Limited Liability Company |
| Primary Market | Puerto Rico Cooperativas |
| Regulatory Classification | Software vendor / SaaS tool |
| Financial Institution Status | None (not a licensed financial institution) |
| CUSO Status | Not applicable (CERNIQ serves cooperativas, not NCUA credit unions exclusively) |

### 9.4 COSSEC Software Vendor Registration

COSSEC does not currently maintain a formal software vendor approval registry analogous to NCUA's CUSO list. However, COSSEC examiners may inquire about ALM software used by cooperativas during examination. CERNIQ documentation provided to institutions for examiner review should include:

1. CERNIQ platform description (one-page summary)
2. Methodology document (how each metric is calculated)
3. This compliance bible (or relevant sections)
4. Data security summary (Section 6 of this document)
5. Model validation documentation (Module 04 output)

### 9.5 Insurance Considerations

For a fintech SaaS platform serving regulated financial institutions, the following insurance coverage is recommended for KLYTICS LLC:

| Insurance Type | Purpose | Recommended Coverage |
|---|---|---|
| Errors & Omissions (E&O) | Protection if CERNIQ calculation error leads to institutional loss | $1M – $3M per occurrence |
| Cyber Liability | Data breach, ransomware, regulatory fines | $1M – $5M |
| General Liability | Third-party bodily/property claims | $1M per occurrence |
| Directors & Officers | Management decisions | $1M |

**E&O Note:** Given CERNIQ's regulatory positioning (tool, not fiduciary), E&O claims would need to establish that a CERNIQ calculation error — not a human decision by institution management — directly caused a regulatory loss. The liability framework in Section 9.1 is designed to mitigate this exposure.

---

## 10. COMPLIANCE CALENDAR

### 10.1 Monthly Compliance Tasks

| Task | Owner | Trigger | CERNIQ Tool |
|---|---|---|---|
| Review COSSEC website for new circular letters | Compliance Lead | 1st of each month | Manual check + C-11 Regulatory Monitor (planned) |
| Run LCR calculation for all active institutions | System (automated) | 5th of each month | Module 41 (auto-run) |
| Net Worth Ratio monitoring | System (automated) | Month-end | Module 57 (auto-run) |
| Cash flow 30-day projection refresh | System (automated) | Month-end | Module 43 (auto-run) |
| Audit log review | C-03 CLI | Daily (auto) | C-03 runs nightly at 1am AST |
| Funding concentration check | System (automated) | Month-end | Module 49 |

### 10.2 Quarterly Compliance Tasks

| Task | Timing | Owner | CERNIQ Action |
|---|---|---|---|
| Full CERNIQ ALM report generation for all institutions | 30 days post quarter-end | CERNIQ System + Institution | C-04 Report Generator |
| COSSEC self-assessment scoring | Same as report | CERNIQ System | C-01 Validator (auto-runs with each report) |
| NCUA Form 5300 deadline tracking | 30 days post Q-end | CERNIQ (NCUA institutions) | C-02 NCUA Sync CLI |
| NII Sensitivity refresh (±300bp) | Same as report | Module 07 | Auto-included in report |
| EVE/NEV refresh | Same as report | Module 08 | Auto-included in report |
| Stress test execution | Same as report | Module 09 | Auto-included in report |
| Peer benchmark update | Same as report | Module 40 | Auto-included in report |
| Customer compliance score notification | Same as report | CERNIQ System | Automated email to institution admin |

### 10.3 Annual Compliance Tasks

| Task | Timing | Owner | CERNIQ Action |
|---|---|---|---|
| ALM Policy review reminder | November 1 each year | CERNIQ System | Automated email with policy checklist |
| Model validation reminder | Institution's model validation anniversary | CERNIQ System | Automated notification |
| Contingency Funding Plan review reminder | October 1 each year | CERNIQ System | Automated email with CFP module link |
| CERNIQ Terms of Service review | January each year | KLYTICS Legal | Internal review |
| Insurance policy renewal | Policy anniversary | KLYTICS Finance | Internal task |
| Annual COSSEC examination preparation audit | Q4 (Oct-Dec) | Compliance Lead | Full evidence package checklist run |
| GDPR/CCPA/Act 81 compliance review | Q1 each year | KLYTICS Legal + Engineering | Data audit |
| Security penetration test | Q2 each year | KLYTICS Engineering | External pentest firm |

### 10.4 As-Needed Compliance Tasks

| Trigger | Response | Owner | Timeline |
|---|---|---|---|
| COSSEC issues new circular letter | Review, assess impact on modules, update thresholds | Engineering + Compliance | 30 days from issuance |
| Institution receives COSSEC examination finding | Provide finding response template, run self-assessment | Customer Success | Same day |
| New institution onboarding | Run COSSEC pre-examination baseline assessment | CERNIQ System (auto) | At first report generation |
| Data breach or security incident | Activate incident response plan; notify affected institutions within 72 hours | Engineering + Legal | Immediate |
| Customer requests data deletion | Initiate 30-day deletion workflow | Engineering | Within 30 days |
| New NCUA letter or regulation | Update NCUA module mapping, notify NCUA customers | Engineering | 45 days from issuance |

---

## 11. REGULATORY CHANGE MANAGEMENT

### 11.1 How CERNIQ Monitors COSSEC Regulatory Changes

COSSEC publishes regulatory updates through the following official channels:

1. **COSSEC Official Website (www.cossec.pr.gov)** — Circular letters, examination updates, press releases
2. **COSSEC Legal Register Filings** — Formal rulemaking through Puerto Rico's Register of Laws
3. **Puerto Rico Register of Regulations** — Official regulatory text changes
4. **COSSEC Direct Communications** — Email notifications to regulated entities (institutions receive; KLYTICS monitors for institutions on platform)

**CERNIQ Monitoring Protocol:**
- KLYTICS Compliance Lead performs manual check of COSSEC website on the 1st of each month
- Automated web monitoring tool (configured to alert on new publications at cossec.pr.gov) runs weekly
- CERNIQ institutional customers are encouraged to forward COSSEC communications to compliance@klytics.co
- NCUA monitoring: NCUA.gov Letters to Credit Unions RSS feed is subscribed and auto-parsed for IRR/ALM keywords

### 11.2 Circular Letter Ingestion Process

When a new COSSEC circular letter is detected:

**Step 1 — Initial Review (Days 1-3)**
- KLYTICS Compliance Lead reads the full circular
- Identifies which CERNIQ modules, thresholds, or report sections are affected
- Drafts an impact assessment memo (internal)
- If high impact (threshold changes, new reporting requirements): escalate immediately to engineering

**Step 2 — Engineering Impact Assessment (Days 3-10)**
- Engineering team reviews affected modules
- Estimates development effort (hours)
- Determines whether change requires: (a) threshold value update only (configuration change, < 1 day), (b) new module development (1-4 weeks), or (c) report structure update (1-2 weeks)
- Creates GitHub issue with regulatory reference tag

**Step 3 — Development and Testing (per timeline above)**
- Module threshold changes are configuration-level (PostgreSQL regulatory_thresholds table update — no code deployment required)
- New module development follows standard NestJS development + test cycle
- All regulatory changes require: unit tests for new thresholds, integration test for affected reports, bilingual text review for any new report language

**Step 4 — Customer Notification (pre-deployment)**
- Email to all affected institution admins (COSSEC customers or NCUA customers as applicable)
- Subject: "CERNIQ Regulatory Update — [Circular Letter Reference]"
- Content: what changed, when CERNIQ will reflect the change, any action needed by institution
- Timeline: notification sent at least 5 business days before deployment when possible

**Step 5 — Deployment and Verification**
- Standard CI/CD deployment via GitHub Actions → staging → production
- Post-deployment: run C-01 COSSEC Validator on test institution to verify new thresholds fire correctly
- Update this document (Vol10) and CERNIQ regulatory reference tables with new circular letter number

### 11.3 Module Update Protocol When Regulations Change

| Change Type | Protocol | Timeline | Notification |
|---|---|---|---|
| Threshold value change (e.g., Duration Gap limit moves from 3.0 to 2.5 years) | Update `regulatory_thresholds` table in PostgreSQL; C-01 reads from DB not hardcode | 1 business day | Email + in-app banner |
| New required metric (e.g., COSSEC adds new stress scenario) | New CERNIQ module developed (Module 63+); report page added | 30-45 days | Email notification 15 days prior |
| Changed reporting frequency (e.g., from quarterly to monthly) | Update scheduling config; notify institutions of new cadence | 10 business days | Email 10 days prior |
| New report section required | C-04 report template updated; new page added to PDF | 15-30 days | Email notification |
| Terminology change (regulatory term renamed in Spanish/English) | Bilingual text updates across all affected report pages | 5 business days | Release note |

### 11.4 Customer Notification Flow

```
COSSEC issues new circular letter
           ↓
KLYTICS Compliance Lead reviews (Day 1-3)
           ↓
Impact Assessment: Affects which customers?
 → All COSSEC institutions (circular applies to all cooperativas)
 → Specific asset-size cohort (circular applies to institutions > $X in assets)
 → NCUA customers only
           ↓
Engineering estimates timeline
           ↓
Draft customer email:
 Subject: "Actualización Regulatoria CERNIQ / CERNIQ Regulatory Update — [CC-YYYY-NN]"
 Body (bilingual):
   - Summary of circular letter (what changed)
   - CERNIQ modules affected
   - When CERNIQ will reflect the change (date)
   - Action required by institution before CERNIQ update (if any)
   - Link to COSSEC official circular
           ↓
Send to: All institution admin email addresses (via CERNIQ notification system)
           ↓
Development complete → Deploy update
           ↓
Post-deployment notification:
 Subject: "CERNIQ Updated — [CC-YYYY-NN] Now Reflected"
 Body: Confirmation that new thresholds/requirements are live
           ↓
Update Vol10 regulatory reference tables
```

### 11.5 Version Control for Regulatory Interpretations

CERNIQ maintains a **Regulatory Interpretation Log** in PostgreSQL that records:

| Field | Description |
|---|---|
| `regulatoryRef` | Circular letter number or NCUA letter reference |
| `interpretationDate` | When KLYTICS's interpretation was established |
| `interpretationSummary` | One-paragraph description of CERNIQ's interpretation |
| `implementedInVersion` | CERNIQ platform version where change was deployed |
| `modulesAffected` | Array of module numbers |
| `thresholdChanges` | Before/after threshold values |
| `approvedBy` | KLYTICS Compliance Lead name |
| `institutionNotifiedDate` | Date notification was sent |

This log is available to institutional customers upon request and can be provided to COSSEC examiners as evidence of CERNIQ's regulatory alignment methodology.

**Institutional customers should note:** CERNIQ's interpretation of COSSEC circulars reflects KLYTICS's good-faith reading of published guidance. If a cooperativa's own legal or compliance counsel interprets a circular differently, the institution's interpretation governs for that institution's regulatory submissions. CERNIQ can be configured with institution-specific thresholds that override CERNIQ defaults where an institution's board has established different limits.

---

## APPENDIX A: REGULATORY QUICK REFERENCE CARD (BILINGUAL)

| Metric | Límite COSSEC / COSSEC Limit | Nivel de Alerta / Warning Level | Circular |
|---|---|---|---|
| Duration Gap | ≤ 3.0 años/years | > 2.0 años/years | CC-2020-03 |
| NII Sensitivity ±300bp | ≤ ±20% | ±15% | CC-2020-03 |
| EVE Change ±300bp | ≤ -20% decline | -15% decline | CC-2020-03 |
| LCR | ≥ 100% | < 110% | CC-2021-02 |
| NSFR | ≥ 100% | < 110% | CC-2021-02 |
| Net Worth Ratio (Well-Capitalized) | ≥ 10% | < 10% | CC-2022-01 |
| Net Worth Ratio (Adequately Capitalized) | ≥ 7% | < 7% = PCA | CC-2022-01 |
| ROA | ≥ 0.25% | < 0.50% | CC-2023-04 |
| Delinquency Rate | ≤ 3% | > 3% | CC-2023-04 |
| Charge-off Rate | ≤ 1% | > 1% | CC-2023-04 |
| Efficiency Ratio | ≤ 80% | > 80% | CC-2023-04 |
| Deposit Beta | 0.20 – 0.50 | > 0.65 or < 0.15 | CC-2020-03 |

---

## APPENDIX B: DOCUMENT REVISION HISTORY

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0.0 | 2026-04-16 | Initial publication — Vol10 Compliance & Regulatory Bible | KLYTICS LLC |

---

*CERNIQ Vol10 — Compliance & Regulatory Bible | KLYTICS LLC | cerniq.app*
*This document is updated when COSSEC or NCUA issues material regulatory changes. Current as of 2026-04-16.*
*Prepared for internal KLYTICS use and distribution to institutional customers under active DPA.*
