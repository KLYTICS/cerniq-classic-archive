# CERNIQ GLOBAL FINANCE ENGINEERING BIBLE

**The Authoritative Technical and Commercial Reference for Finance Teams Worldwide**

| Field | Value |
|---|---|
| Document Class | Global Finance Engineering Bible |
| Version | 1.0 |
| Effective Date | 2026-04-16 |
| Platform | CERNIQ ALM Reporting Platform |
| Legal Entity | KLYTICS LLC |
| Classification | Public — Sales, Technical, Regulatory Reference |
| Audience | CFO, CRO, Treasurer, ALM Committee, Board, Regulators, CPA Firms |

---

> **Legal Notice:** CERNIQ is a decision-support instrument, not a fiduciary advisor. All regulatory, capital, and investment decisions remain the sole responsibility of the licensed financial institution and its qualified personnel. CERNIQ generates data-driven analytical reports; it does not certify regulatory compliance on behalf of any institution.

---

## TABLE OF CONTENTS

1. [The Global ALM Problem](#1-the-global-alm-problem)
2. [CERNIQ's Engineering Moat](#2-cerniqs-engineering-moat)
3. [The 62-Module Technical Almanac](#3-the-62-module-technical-almanac)
4. [The Global Expansion Architecture](#4-the-global-expansion-architecture)
5. [The No-Brainer ROI Calculator](#5-the-no-brainer-roi-calculator)
6. [The Implementation Playbook](#6-the-implementation-playbook)
7. [The Engineering Quality Guarantee](#7-the-engineering-quality-guarantee)
8. [Competitive Destruction Matrix](#8-competitive-destruction-matrix)
9. [The Global Finance Team Manifesto](#9-the-global-finance-team-manifesto)

---

## 1. THE GLOBAL ALM PROBLEM

### 1.1 The Quarterly Report That Breaks Every Finance Team

Every quarter, somewhere in the world, a financial analyst opens a 400-tab Excel workbook that belongs to no one and everyone. It was built by a consultant who left three years ago. The macros occasionally fail silently. The Duration Gap formula on row 847 references a cell that was deleted during a "cleanup" six months ago. No one knows. The CFO will sign off on the board presentation in four days.

This is not a Puerto Rico problem. This is not a credit union problem. This is the shared condition of thousands of community financial institutions across the United States, Latin America, Europe, and beyond. Asset-Liability Management — the discipline that governs whether an institution survives an interest rate shock, a liquidity crisis, or a regulatory examination — is being practiced with tools built for personal budgeting.

The consequences are no longer theoretical. The 2022-2024 rate cycle — the fastest Fed tightening in 40 years, 525 basis points in 18 months — exposed every ALM blind spot simultaneously. Institutions that had been borrowing short and lending long for a decade of near-zero rates suddenly discovered that their Net Interest Income was collapsing, their Economic Value of Equity was impaired, and their examiners were asking questions their Excel models could not answer.

### 1.2 The True Cost of Manual ALM

**Time cost per quarterly cycle:**

A single quarterly ALM report, produced manually or via consultant, consumes:

- 40-80 analyst hours for data gathering, model updates, scenario runs
- 10-20 hours of CPA or consultant review time
- 4-8 hours of management review and board presentation preparation
- 2-6 weeks of calendar time (consultant scheduling, iteration cycles)

At a fully loaded analyst cost of $35/hour and consultant billing at $150-$300/hour, the quarterly report costs between $3,750 and $18,000 in direct labor — before accounting for the institutional risk of getting the numbers wrong.

**Financial cost per annual cycle:**

| Institution Type | Consultant Cost | Internal Analyst Time | Total Annual ALM Spend |
|---|---|---|---|
| Small cooperativa ($50M assets) | $15,000–$20,000 | $7,000 | $22,000–$27,000 |
| Mid-market credit union ($500M) | $25,000–$40,000 | $15,000 | $40,000–$55,000 |
| Large institution ($2B assets) | $80,000–$150,000 | $50,000 | $130,000–$200,000 |
| CPA firm (10 clients) | N/A (they bill it) | 800–1,600 hrs/year | $120,000–$480,000 cost |

**The Excel failure taxonomy:**

Excel is not an ALM platform. It is a general-purpose calculation tool that has been conscripted into institutional risk management because no affordable alternative existed. Its failure modes are well-documented and financially catastrophic:

1. **Silent formula errors**: A 2011 study by the European Spreadsheet Risks Interest Group found that 88% of production spreadsheets contain errors. Financial model errors are rarely caught until they cause damage.
2. **Version control chaos**: Multiple analysts on multiple copies of the "master" model. Which one is current? Nobody is certain.
3. **Floating-point rounding**: IEEE 754 double-precision arithmetic introduces rounding errors that compound across multi-step calculations on $100M+ balance sheets. A rounding error at the fifth decimal place in a bond price calculation becomes a material error in a portfolio-level EVE sensitivity.
4. **No audit trail**: A cell value can be changed without any record of who changed it, when, or why. This is incompatible with regulatory examination requirements.
5. **Non-reproducibility**: Even when calculations are correct, an Excel model cannot guarantee that running the same inputs twice produces the same outputs after an undocumented change.
6. **No scenario management**: Storing and comparing 20 rate scenarios across 4 quarterly snapshots requires a database, not a grid.

**Regulatory risk:**

NCUA examination findings related to Interest Rate Risk deficiencies are among the most common and most expensive examination outcomes for US credit unions. COSSEC examination findings for Puerto Rico cooperativas follow the same pattern. A single IRR examination deficiency can require:

- Immediate remediation plan submission
- Quarterly progress reporting to the examiner
- Independent model validation by a third party (typically $25,000–$75,000)
- Potential restrictions on asset growth or product offerings until findings are resolved
- Management time: 200–500 hours of staff and board time in a remediation cycle

The total cost of a single examination finding, across all direct and indirect costs, averages $50,000–$200,000 per finding cycle. CERNIQ costs less than $60,000 per year even for the largest institutions. The math is not complicated.

### 1.3 The Rising Rate Wake-Up Call (2022–2024)

The 2022–2024 rate environment was the stress test no institution scheduled. The Federal Reserve raised the federal funds rate from near zero to 5.25%–5.50% in 18 months, a tightening cycle without precedent in the modern era of community banking.

What happened to institutions without proper ALM visibility:

- **NII erosion**: Institutions with liability-sensitive balance sheets saw net interest income compress as deposit rates repriced faster than fixed-rate loan portfolios could roll. Some institutions saw NII decline 15–25% within two quarters.
- **EVE impairment**: Fixed-rate mortgage and loan portfolios marked to market showed Economic Value of Equity declines of 20–40% under +300bps scenarios. For institutions near regulatory capital minimums, this created existential pressure.
- **Deposit runoff**: As money market rates rose above 4%, core deposit outflows accelerated beyond behavioral assumptions built during the near-zero era. Institutions without Deposit Beta models did not see this coming.
- **Liquidity stress**: The same rate environment that compressed NII also triggered elevated loan demand as borrowers locked in rates. Simultaneously, deposit outflows reduced funding availability. LCR and NSFR ratios deteriorated in tandem.

The institutions that navigated this environment well had one thing in common: they had defensible ALM models running before the crisis began.

### 1.4 This Is a Global Problem

The ALM crisis is not geographic. Everywhere that community financial institutions operate under regulatory capital frameworks — which is everywhere — the same pattern repeats:

- **United States**: 5,000+ NCUA-regulated credit unions, 4,500+ FDIC-supervised community banks. Approximately 80% rely on manual Excel processes or engage external consultants for quarterly ALM reporting.
- **Puerto Rico**: 109 COSSEC-regulated cooperativas with $12B in combined assets. Direct CERNIQ target market in production today.
- **Latin America**: Mexico's SOFIPO cooperatives, Colombia's solidaria sector, Chile's cajas de ahorro. Combined institutions numbering in the thousands. Most have no access to institutional-grade ALM tooling in Spanish.
- **Europe**: UK Building Societies (43 institutions, £400B+ assets), German Volksbanken and Raiffeisenbanken (800+ institutions), French credit cooperatives (Crédit Agricole regional banks). All operating under Basel III/IV frameworks with IRR reporting requirements.
- **Developing markets**: Microfinance institutions across Africa, Southeast Asia, and the Middle East face interest rate risk and liquidity risk that their spreadsheet-based processes cannot adequately quantify.

The total addressable market for institutional-grade ALM software for community financial institutions globally exceeds $5 billion annually. CERNIQ enters this market with the most technically sophisticated platform ever purpose-built for this segment.

---

## 2. CERNIQ'S ENGINEERING MOAT

### 2.1 Why CERNIQ Cannot Be Replicated in an Excel Column

The barrier to building what CERNIQ has built is not a trade secret or a patent. It is 62 financial mathematics implementations, each technically correct, each validated against regulatory standards, each integrated into a coherent data pipeline, delivered through an interface that a CFO without a quantitative background can operate. The moat is the combination of depth, breadth, and precision executed together.

What follows is not marketing copy. It is an explanation of the engineering choices that make CERNIQ's calculations defensible in front of any regulator, auditor, or model validator in the world.

### 2.2 Decimal Arithmetic: Why IEEE 754 Is Unacceptable for Institutional Finance

Every CERNIQ financial calculation is performed using PostgreSQL `DECIMAL(20,6)` fields — fixed-point decimal arithmetic with 20 significant digits and 6 decimal places. No floating-point operations are used anywhere in the financial calculation pipeline.

This is not a preference. It is a mathematical requirement.

**The IEEE 754 problem:**

IEEE 754 double-precision floating-point, the arithmetic standard used by JavaScript's `Number` type, Python's `float`, and most programming languages by default, cannot represent most decimal fractions exactly. The number `0.1` cannot be represented exactly in binary floating-point. It becomes `0.1000000000000000055511151231257827021181583404541015625`.

In isolation, this error is vanishingly small. Across thousands of operations on a $100M balance sheet, it compounds:

```
// IEEE 754 floating point (WRONG for finance):
0.1 + 0.2 = 0.30000000000000004

// Decimal arithmetic (CORRECT):
Decimal("0.1").plus(Decimal("0.2")) = Decimal("0.3")
```

A bond portfolio with 500 positions, each carrying 4-6 decimal places of price precision, accumulates rounding errors in EVE calculation that can reach hundreds of thousands of dollars in reported value — errors that are invisible unless you know to look for them, and that cannot be reproduced exactly because the floating-point error is path-dependent.

**CERNIQ's implementation:**

- All balance sheet inputs stored as `DECIMAL(20,6)` in PostgreSQL
- All intermediate calculations performed using Decimal.js in TypeScript (arbitrary-precision decimal library)
- All output values formatted and stored as Decimal before being passed to report generation
- 46 Decimal fields in the production schema, covering every financially material value
- Zero `Number` type conversions in the ALM calculation pipeline

This is the same standard used by SWIFT messaging, central bank systems, and core banking platforms. It is the standard that every model validator will check first.

### 2.3 Monte Carlo Simulation: 10,000 Vasicek Paths

CERNIQ runs 10,000 Monte Carlo interest rate paths using the Vasicek one-factor short rate model. This is not a marketing number — it is the minimum path count required to achieve stable convergence in the 99th percentile confidence interval tails, which is precisely where regulators focus their attention.

**The Vasicek model:**

```
dr_t = κ(θ - r_t)dt + σ dW_t
```

Where:
- `r_t` = short rate at time t
- `κ` = speed of mean reversion (calibrated to historical Fed funds rate dynamics)
- `θ` = long-run equilibrium rate (calibrated to current market expectations)
- `σ` = instantaneous volatility (calibrated to historical rate volatility)
- `dW_t` = Wiener process increment

**Why 10,000 paths:**

The standard error of a Monte Carlo estimate with N paths is proportional to 1/√N. At N=100, the standard error is 10% of the true value — too imprecise for regulatory reporting. At N=1,000, it is 3.2%. At N=10,000, it is 1% — sufficient for 99% confidence intervals with acceptable precision.

CERNIQ runs 10,000 paths to produce:
- 5th and 95th percentile NII bounds under rate uncertainty
- CVaR at 95% and 99% confidence levels
- EVE distribution under stochastic rate paths (not just parallel shocks)
- Probability-weighted average NII (PWANIT) — more informative than any single scenario

**Why Vasicek for community financial institutions:**

The Hull-White and CIR models offer higher fidelity at the cost of significant calibration complexity. Vasicek provides closed-form bond pricing, rapid Monte Carlo generation, and stable calibration from observable market rates — making it the appropriate choice for quarterly regulatory reporting where the goal is defensible results delivered efficiently, not academic precision beyond the precision of the underlying data.

### 2.4 Duration Gap with Key Rate Durations: Full Yield Curve Sensitivity

Standard duration gap analysis measures an institution's exposure to parallel yield curve shifts. This is a necessary but insufficient measure of interest rate risk. The 2022–2024 tightening cycle was not a parallel shift — it was a dramatic steepening followed by a flattening, with short rates moving 5x faster than long rates.

**CERNIQ's Duration Gap implementation:**

Standard Duration Gap:
```
DGAP = D_Assets - (Liabilities/Assets) × D_Liabilities
```

This measures the net duration mismatch between assets and liabilities. A positive DGAP means the institution is liability-sensitive — rising rates will reduce Economic Value of Equity.

**Key Rate Durations extend this to full curve sensitivity:**

```
KRD(τ) = -∂P / ∂y(τ) × 1/P
```

Where `y(τ)` is the yield at maturity bucket `τ`. CERNIQ computes KRDs at standard ISDA tenor points: 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y, 20Y, 30Y.

This enables:
- Non-parallel curve shift sensitivity (steepener, flattener, butterfly)
- Identification of specific maturity buckets driving duration mismatch
- Hedging efficiency analysis (which tenor to swap or add to reduce KRD exposure)
- Regulatory examination documentation showing full curve sensitivity, not just +/- 100bp parallel

COSSEC and NCUA examiners increasingly ask for non-parallel scenario analysis. CERNIQ delivers it as a standard output.

### 2.5 CECL Vintage Analysis: FASB ASC 326 Compliance

The Current Expected Credit Loss (CECL) standard replaced the incurred loss model for US financial institutions after January 2023. The CECL vintage analysis approach is the most analytically rigorous method for calculating loan loss allowances under FASB ASC 326.

**The vintage analysis methodology:**

```
ALLL = Σ[cohort c] [Outstanding_balance(c) × PD(c,t) × LGD(c)]
```

Where vintage cohorts are segmented by loan origination period and performance history is tracked cohort-by-cohort.

CERNIQ implements:
- Cohort segmentation by origination quarter and loan type
- Historical PD (Probability of Default) curves estimated from cohort performance data
- LGD (Loss Given Default) estimation by collateral type and seniority
- Lifetime loss projection using a Q-factor adjustment for macroeconomic forecasts
- Reversion to historical loss rates over the reasonable and supportable forecast horizon
- Documentation trail mapping every allowance dollar to its originating cohort

The output is an ASC 326-compliant CECL allowance schedule with full cohort-level detail — exactly what an auditor or examiner will request during model validation.

### 2.6 Black-Litterman Portfolio Optimization: Bayesian Asset Allocation

The Black-Litterman model is the portfolio optimization framework used by Goldman Sachs, Morgan Stanley, and every major institutional asset manager for one reason: it produces stable, investable portfolios. Mean-variance optimization, the Markowitz framework taught in every finance textbook, produces portfolios that are mathematically optimal but practically unusable — corner solutions with 80% in a single asset, extreme sensitivity to small parameter changes.

**The Black-Litterman formula:**

```
E[R]_BL = [(τΣ)^(-1) + P'Ω^(-1)P]^(-1) × [(τΣ)^(-1)Π + P'Ω^(-1)Q]
```

Where:
- `Π` = implied equilibrium excess returns (reverse-engineered from market cap weights)
- `P` = view matrix (which assets the investor has views on)
- `Q` = view returns vector
- `Ω` = view uncertainty matrix (diagonal, represents confidence)
- `τ` = scalar (typically 0.025, reflecting uncertainty in equilibrium returns)
- `Σ` = covariance matrix of asset returns

The Black-Litterman framework starts from a neutral equilibrium portfolio and tilts toward the portfolio manager's views in proportion to confidence in those views. The result is a portfolio that is both theoretically grounded and practically investable.

For a credit union's investment portfolio, this means:
- Base case: market-cap-weighted allocation to the available investment universe
- Overlay: board-approved directional views on rates, spreads, and duration
- Output: optimal portfolio weights that reflect both market equilibrium and institutional views
- Constraint set: regulatory investment restrictions (CU investment guidelines, NCUA Part 703) baked into the optimization

### 2.7 Hierarchical Risk Parity: Machine Learning Allocation Without Covariance Instability

HRP (Hierarchical Risk Parity), developed by Marcos Lopez de Prado at AQR Capital Management, solves the fundamental instability problem of classical portfolio optimization: the covariance matrix.

Classical mean-variance optimization requires inverting the covariance matrix. When assets are correlated (which they always are in financial portfolios), the matrix becomes near-singular, and small estimation errors in the covariance produce wildly different optimal portfolios. This is why Markowitz portfolios are famously unstable out-of-sample.

**HRP methodology:**

1. **Hierarchical clustering**: Assets are organized into a dendrogram using Ward's linkage on their correlation distance matrix. Highly correlated assets are grouped together.

2. **Quasi-diagonalization**: The covariance matrix is reorganized so that correlated assets are adjacent, revealing the natural block structure of the portfolio's risk.

3. **Recursive bisection**: Risk is allocated top-down through the dendrogram. At each branch point, risk budget is split inversely proportional to cluster variance.

```
w_cluster = ClusterVariance(complement) / (ClusterVariance(left) + ClusterVariance(complement))
```

**Why HRP for institutional portfolios:**

- No matrix inversion required — immune to near-singular covariance matrices
- Automatically handles highly correlated asset classes (e.g., UST 5Y and UST 7Y)
- Out-of-sample Sharpe ratio consistently higher than mean-variance optimized portfolios in academic studies
- Produces diversified portfolios without ad hoc constraints
- Explainable: the dendrogram structure provides intuitive narrative for board presentations

### 2.8 KMV-Merton Structural Credit Risk Model

The KMV-Merton model, the structural credit risk framework developed by Robert Merton (1974) and commercialized by Moody's KMV, is the industry standard for estimating corporate default probability from market observables. CERNIQ implements the full structural model for counterparty credit risk assessment.

**The Merton framework:**

Merton's insight was that a firm's equity is a call option on the firm's assets:

```
E = V × N(d₁) - D × e^(-rT) × N(d₂)
```

Where:
- `E` = market value of equity (observable)
- `V` = market value of assets (unobservable, estimated via option pricing inversion)
- `D` = face value of debt (balance sheet)
- `r` = risk-free rate
- `T` = debt maturity

```
d₁ = [ln(V/D) + (r + σ²ᵥ/2)T] / (σᵥ√T)
d₂ = d₁ - σᵥ√T
```

**Distance to Default:**

```
DD = (ln(V/D) + (μ - σ²ᵥ/2)T) / (σᵥ√T)
```

Where `μ` is the expected asset return. DD measures how many standard deviations the firm's asset value is from the default point. Higher DD = lower default probability.

**Probability of Default:**

```
PD = N(-DD)
```

CERNIQ applies this framework to:
- Corporate bond issuers in investment portfolios (counterparty PD estimation)
- Major borrower credit risk assessment
- Concentration risk evaluation across the loan book

The KMV-Merton model produces point-in-time PD estimates calibrated to current market conditions, as opposed to through-the-cycle PD estimates from historical default rates. For regulatory capital and CECL purposes, both approaches are required.

### 2.9 FRTB-IMA: Basel IV Internal Models Approach

The Fundamental Review of the Trading Book (FRTB), the Basel Committee's revision to market risk capital under Basel IV, is the most significant change to market risk regulation in a generation. The Internal Models Approach (IMA) under FRTB replaces Value at Risk (99%, 10-day) with Expected Shortfall (97.5%, variable liquidity horizon) as the regulatory capital measure for trading book risk.

**FRTB-IMA Expected Shortfall:**

```
ES(X, α) = E[X | X ≥ VaR(α)]
```

ES captures the average loss in the worst (1-α)% of outcomes, whereas VaR only tells you the threshold. ES is a coherent risk measure (subadditive, convex) whereas VaR is not.

FRTB-IMA requires:
- Desk-level ES calculation with liquidity horizon adjustments
- P&L attribution tests (daily model P&L vs. actual P&L)
- Backtesting against 250 days of observed returns
- Sensitivity-based method (SBM) as fallback
- Non-modellable risk factor (NMRF) capital add-on

CERNIQ implements FRTB-IMA for institutions with trading book positions, providing Basel IV compliant capital calculations aligned with final rules effective 2025.

### 2.10 The Audit Trail Architecture: Immutability by Design

Every CERNIQ report is architecturally immutable. This is not a policy statement — it is a technical guarantee enforced by the system:

1. **Input hash**: When a CSV file is uploaded, its SHA-256 hash is recorded. Any subsequent modification to the underlying data is detectable by hash comparison.

2. **Calculation parameters logged**: Every model parameter used in every calculation — Vasicek κ, θ, σ; CECL PD curves; Duration Gap yield assumptions — is written to the `calculation_audit` table before execution begins.

3. **Output locking**: Once a report PDF is generated and stored on Cloudflare R2, its hash is written to the `report_artifacts` table. The artifact storage path and hash constitute a tamper-evident seal.

4. **AES-256-GCM encryption**: All stored financial data is encrypted at rest using AES-256-GCM. The encryption key is institution-specific and never shared between tenants.

5. **Full audit log**: Every user action — login, parameter change, report generation, download — is timestamped and written to an append-only audit log. Logs cannot be deleted through the application interface.

6. **Decimal precision guarantee**: Output values in the PDF match stored Decimal values exactly, with no float conversion between storage and rendering.

This architecture means that a CERNIQ-generated report is reproducible, traceable, and defensible in front of any regulator, auditor, or court.

---

## 3. THE 62-MODULE TECHNICAL ALMANAC

CERNIQ's 62 ALM modules are organized into 7 functional suites, each anchored to one or more regulatory frameworks. What follows is the complete technical reference for each suite and module.

---

### SUITE 1: INTEREST RATE RISK (7 Modules)

**Regulatory anchor:** NCUA IRR Supervision Policy (12 CFR Part 741), COSSEC Circular COSSEC-I-09, Basel IRRBB (2016), EBA GL/2018/02

Interest Rate Risk is the primary risk class for most community financial institutions. The 7 modules in this suite provide a complete, defensible IRR framework aligned with all major regulatory requirements.

---

#### Module 1.1: Duration Gap

**Mathematical foundation:**

Duration Gap measures the net interest rate sensitivity of the institution's balance sheet:

```
DGAP = D_A - (L/A) × D_L

where:
D_A = asset-weighted modified duration
D_L = liability-weighted modified duration
L   = total liabilities
A   = total assets
```

For a non-maturity deposit (NMD) with behavioral duration modeled via decay function:

```
D_NMD = ∫[0 to T] t × f(t) dt / ∫[0 to T] f(t) dt

where f(t) is the empirical deposit decay function calibrated from historical data
```

**Inputs required:** Balance sheet CSV with asset/liability classification, maturity bucketing, coupon/rate, outstanding balance

**Output:** Duration Gap in years, with asset and liability duration breakdowns, color-coded against regulatory thresholds (GREEN: DGAP ≤ 1.5yr, YELLOW: 1.5–3.0yr, RED: > 3.0yr per COSSEC guidance)

**Regulatory reference:** COSSEC-I-09 requires DGAP ≤ 3.0 years. NCUA Letter 12-CU-14 recommends DGAP review quarterly.

**Global applicability:** Universal. Every Basel III-compliant jurisdiction requires duration gap or equivalent IRR measurement. EBA IRRBB guidelines require it for EU banks.

---

#### Module 1.2: NII Sensitivity

**Mathematical foundation:**

Net Interest Income Sensitivity measures how NII changes under rate shock scenarios:

```
ΔNII(Δr) = Σ[assets] CF_A(t) × Δr × (1 - t/T_A) - Σ[liabilities] CF_L(t) × Δr × β_L × (1 - t/T_L)
```

Where `β_L` is the Deposit Beta — the fraction of a rate change passed through to deposit rates:

```
β_L = ΔDeposit_rate / ΔPolicy_rate
```

CERNIQ calibrates Deposit Beta from institution-specific historical data or sector averages when history is insufficient.

**Shock scenarios computed:**
- +100bps, +200bps, +300bps parallel shift
- -100bps, -200bps, -300bps parallel shift
- Steepener (+50bps short / +150bps long)
- Flattener (+150bps short / +50bps long)
- Instantaneous vs. gradual repricing paths

**Output:** NII Sensitivity table (12-month and 24-month horizon), percentage change from base case, breach flags against ±20% NII threshold (COSSEC) and ±15% (NCUA IRR policy)

**Regulatory reference:** NCUA 12 CFR 741.3(b)(5), COSSEC Circular 2022-02, Basel IRRBB Principle 4

---

#### Module 1.3: Economic Value of Equity (EVE)

**Mathematical foundation:**

EVE is the net present value of all expected asset and liability cash flows:

```
EVE(r₀) = Σ[i] PV(CF_A_i, r₀) - Σ[j] PV(CF_L_j, r₀)

EVE_shocked = Σ[i] PV(CF_A_i, r₀ + Δr) - Σ[j] PV(CF_L_j, r₀ + Δr)

ΔEVE = EVE_shocked - EVE(r₀)
```

For fixed-rate instruments, present value uses discount factors derived from the shocked yield curve:

```
PV(CF, t, Δr) = CF × e^(-(r(t) + Δr) × t)
```

For floating-rate instruments with repricing dates, EVE reflects only the spread component, as the floating rate component reprices to fair value at each reset date.

**Output:** EVE at base and under 6 shock scenarios, ΔEVE in dollars and percentage, equity at risk (EVE sensitivity as a percentage of CET1 capital)

**Regulatory reference:** BCBS IRRBB (2016) Pillar 2 EVE requirements; NCUA IRR Supervision requires institutions to demonstrate EVE sensitivity analysis; COSSEC requires quarterly reporting

---

#### Module 1.4: Basis Point Value (BPV)

**Mathematical foundation:**

```
BPV = -Modified_Duration × Market_Value × 0.0001
```

BPV expresses the dollar change in portfolio value for a 1 basis point (0.01%) change in yield. Also known as DV01 (Dollar Value of 01).

For a bond portfolio with n positions:

```
Portfolio_BPV = Σ[i=1 to n] BPV_i = Σ[i=1 to n] -D_mod_i × MV_i × 0.0001
```

**Why BPV matters for hedging:**

When an institution wants to add a hedge (interest rate swap, Treasury purchase) to reduce duration mismatch, the hedge notional is computed directly from BPV:

```
Hedge_Notional = Portfolio_BPV / BPV_per_unit_hedge
```

**Output:** Portfolio BPV in dollars, position-level BPV decomposition, hedge notional recommendation

**Regulatory reference:** Used in FRTB-SBM (Sensitivity-Based Method) as the delta sensitivity for interest rate risk; required for IRRBB Pillar 2 reporting

---

#### Module 1.5: Key Rate Durations (KRD)

**Mathematical foundation:**

Key Rate Duration at tenor τ measures price sensitivity to a 1% change in the yield at maturity τ, holding all other maturities constant:

```
KRD(τ) = -ΔP / (P × Δy(τ))
```

KRDs are computed at 11 standard tenor points: 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 15Y, 20Y, 30Y.

The sum of all KRDs equals the total modified duration:

```
D_mod = Σ[τ] KRD(τ)
```

**KRD profile interpretation:**

A portfolio with large KRD at the 10Y and 30Y tenors is exposed to long-end rate movements — typical for institutions with fixed-rate mortgage concentrations. A portfolio with large KRD at 3M and 6M is exposed to short-end movements — typical for floating-rate loan books.

**Output:** KRD profile chart (bar chart by tenor), total duration decomposition, non-parallel scenario sensitivities (steepener, flattener, butterfly)

**Regulatory reference:** FRTB Sensitivity-Based Method uses KRD-equivalent delta sensitivities; IRRBB CP2 (2022) requires non-parallel curve scenario analysis

---

#### Module 1.6: Rate Shock v2

**Mathematical foundation:**

Rate Shock v2 applies standardized regulatory shock scenarios to compute both NII and EVE impacts simultaneously in a single integrated framework:

```
Scenarios:
  +100bps, +200bps, +300bps parallel up
  -100bps, -200bps, -300bps parallel down
  Short +300bps / Long +100bps (bear steepener)
  Short +100bps / Long +300bps (bull steepener)
  Short +300bps / Long -100bps (bear flattener)
```

BCBS IRRBB (2016) specifies 6 standard supervisory shock scenarios. CERNIQ implements all 6 plus institution-customizable additional scenarios through the Scenario Builder module.

**Output:** Combined NII+EVE shock table, heatmap visualization with threshold breaches highlighted, regulatory scenario narrative in English and Spanish

**Regulatory reference:** BCBS IRRBB Principle 5 (supervisory shock scenarios); COSSEC Circular 2022-02 Table 2

---

#### Module 1.7: Repricing Gap

**Mathematical foundation:**

The Repricing Gap measures the dollar difference between assets and liabilities repricing within each time bucket:

```
Gap(τ) = Repricing_Assets(τ) - Repricing_Liabilities(τ)

Cumulative_Gap(T) = Σ[τ=0 to T] Gap(τ)
```

The interest rate impact on NII from the cumulative gap:

```
ΔNII(T, Δr) = Cumulative_Gap(T) × Δr × (T/12)
```

Time buckets: 0-30 days, 31-90 days, 91-180 days, 181-365 days, 1-2 years, 2-3 years, 3-5 years, 5+ years

**Output:** Repricing Gap table by tenor bucket, cumulative gap, NII impact estimate per scenario, repricing gap chart

**Regulatory reference:** OCC Handbook Interest Rate Risk (2012); FDIC Manual Section 7.1 Repricing Analysis; COSSEC IRR disclosure template

---

### SUITE 2: STRESS TESTING (6 Modules)

**Regulatory anchor:** DFAST (Dodd-Frank Act Stress Testing), Basel III/IV Pillar 2, NCUA Stress Test guidance, COSSEC examination requirements

---

#### Module 2.1: Monte Carlo Simulation

**Mathematical foundation:**

Vasicek short rate dynamics under the physical measure:

```
dr_t = κ(θ - r_t)dt + σ dW_t

Discrete approximation (Euler-Maruyama):
r_{t+Δt} = r_t + κ(θ - r_t)Δt + σ√Δt × Z_t

where Z_t ~ N(0,1) i.i.d.
```

**Calibration from market data:**

```
κ̂ = -ln(1 - OLS_slope_on_lagged_residuals) / Δt
θ̂ = OLS_intercept / κ̂
σ̂ = Standard_error_of_OLS_residuals / √Δt
```

**10,000-path simulation:**

For each simulation path i = 1, ..., 10,000:
1. Simulate 12 monthly rate realizations from current rate
2. Compute NII along the path using repricing gap model
3. Compute EVE at terminal date under path-specific rate
4. Record NII_i and EVE_i

**Output statistics:**
```
E[NII] = (1/N) × Σ NII_i
VaR_95[NII] = 5th percentile of NII distribution
CVaR_95[NII] = E[NII | NII ≤ VaR_95]
Confidence interval: [5th percentile, 95th percentile]
```

**Output:** NII and EVE distribution histograms, confidence interval bounds, probability of NII declining >10%, >20%, >30% from base case

**Regulatory reference:** DFAST 12 CFR Part 252 (Stress Testing Rules); NCUA guidance on IRR stress testing; COSSEC examination examiner guidance

---

#### Module 2.2: Scenario Builder

Custom scenario definition tool for institution-specific stress events:

- **Rate scenario definition**: Define any yield curve shape across 11 tenor points
- **Credit scenario overlay**: Apply credit spread widening to investment portfolio
- **Behavioral scenario**: Override deposit beta, prepayment speed, draw rates
- **Combined scenario**: Link macro variable (unemployment, GDP) to multiple balance sheet drivers

Scenario Builder outputs feed into Scenario Compare, Board Report, and Exam Prep modules.

**Regulatory reference:** NCUA IRR Supervision guidance on institution-defined scenarios; Basel IRRBB Principle 6 (institution-specific scenarios)

---

#### Module 2.3: Scenario Compare

Side-by-side comparison dashboard for up to 10 simultaneous scenarios:

```
Output columns per scenario:
  NII (12-month), ΔNII%, EVE, ΔEVE%, ΔEVE/Capital%,
  Duration Gap, LCR, Net Income Impact
```

Supports:
- Base case vs. stress comparison
- Current quarter vs. prior quarter trend
- Management scenarios vs. regulatory scenarios
- Export to Excel and PDF for board distribution

---

#### Module 2.4: Stress Pack

Pre-packaged regulatory stress scenario suite:

| Scenario | Description | Source |
|---|---|---|
| S1 | +300bps instantaneous parallel | COSSEC standard |
| S2 | -300bps instantaneous parallel | COSSEC standard |
| S3 | Bear steepener | COSSEC standard |
| S4 | 2008 GFC rate path | Historical |
| S5 | 2022-2024 tightening path | Historical |
| S6 | 1994 bond market crash | Historical |
| S7 | COVID-19 rate path (2020) | Historical |
| S8 | Institution-custom | User-defined |

**Regulatory reference:** COSSEC Examination Scope Manual; NCUA Examiner Guide Section 5700; FFIEC Interest Rate Risk FAQ

---

#### Module 2.5: FRTB-IMA

Basel IV-compliant Internal Models Approach implementation:

**Expected Shortfall (ES) calculation:**

```
ES_α = (1/(1-α)) × ∫[α to 1] VaR_u du

Discrete approximation:
ES_0.975 = E[Loss | Loss > VaR_0.975]
```

**FRTB liquidity horizons:**

| Asset Class | Liquidity Horizon |
|---|---|
| Interest rate (major) | 10 days |
| Credit spread IG | 40 days |
| Credit spread HY | 60 days |
| Equity large cap | 10 days |
| Equity small cap | 20 days |

**P&L Attribution Test:**

```
Spearman rank correlation between Risk-Theoretical P&L and Hypothetical P&L ≥ 0.8
Kolmogorov-Smirnov statistic on distribution tails ≤ critical value
```

**Regulatory reference:** BCBS FRTB Final Rule (January 2019); Basel IV effective date January 2025; EU CRR3 Article 325b

---

#### Module 2.6: Rate Shock (Legacy + Transition Compatibility)

Backward-compatible rate shock module maintaining format compatibility with FFIEC Uniform Bank Performance Report (UBPR) and legacy COSSEC reporting formats. Produces parallel-shift NII and EVE tables in the exact format required by legacy examination submissions.

---

### SUITE 3: CREDIT RISK (6 Modules)

**Regulatory anchor:** FASB ASC 326 (CECL), Basel III/IV Credit Risk Capital, FFIEC Allowance for Loan and Lease Losses

---

#### Module 3.1: CECL Vintage Analysis

**Mathematical foundation:**

CECL (Current Expected Credit Loss) requires estimation of lifetime expected losses at origination:

```
ACL = Σ[s=1 to S] Σ[t=1 to T] EAD(s,t) × PD(s,t) × LGD(s,t) × DF(t)

where:
s = loan segment (consumer, commercial, mortgage, auto, etc.)
t = time period in projection horizon
EAD = Exposure at Default (outstanding balance at time t)
PD = Probability of Default conditional on surviving to time t
LGD = Loss Given Default (1 - recovery rate)
DF = Discount factor at time t
```

**Vintage analysis cohort structure:**

```
Cohort(origination_quarter) → Performance track (delinquency, default) → Annual loss rate curve
```

CERNIQ tracks each origination quarter as a separate cohort and fits cohort-specific cumulative default curves:

```
CDR(t) = 1 - exp(-∫[0 to t] h(u) du)

where h(t) is the hazard rate, fitted via maximum likelihood
```

**Q-factor macroeconomic adjustment:**

FASB ASC 326 requires a reasonable and supportable forecast adjustment:

```
PD_adjusted(t) = PD_historical × (1 + Q_factor × ΔMacro(t))

where Q_factor calibrated via regression: ΔDelinquency ~ ΔUnemployment + ΔGDP + ΔRates
```

**Output:** CECL allowance by segment and vintage cohort, allowance as % of outstanding balance, period-over-period change analysis, Q-factor sensitivity table

**Regulatory reference:** FASB ASC 326-20 (Financial Instruments — Credit Losses); NCUA CECL compliance letter 2022-CU-02; FFIEC CECL Joint Statement

---

#### Module 3.2: KMV-Merton Structural Credit Model

Full Merton framework implementation (detailed in Section 2.8). Outputs:
- Distance to Default by counterparty
- Implied Asset Value and Asset Volatility (KMV inversion)
- 1-year Probability of Default
- Credit spread implied by structural model
- Comparison to agency ratings when available

**Regulatory reference:** Basel III Credit Risk — IRB Approach (PD estimation); CECL PD/LGD estimation for non-retail portfolios

---

#### Module 3.3: Copula Credit Model

**Mathematical foundation:**

Gaussian copula for portfolio credit correlation:

```
Default correlation: ρ_ij = Corr(Φ^(-1)(PD_i), Φ^(-1)(PD_j))

Joint default probability:
P(D_i, D_j) = Φ_2(Φ^(-1)(PD_i), Φ^(-1)(PD_j); ρ_ij)

where Φ_2 is bivariate normal CDF
```

Portfolio loss distribution computed via Monte Carlo:
1. Sample correlated uniform variates using Cholesky decomposition
2. Convert to default indicators using PD thresholds
3. Compute portfolio loss per simulation
4. Extract loss distribution percentiles and EL/UL

**Output:** Portfolio Expected Loss (EL), Unexpected Loss (UL), Economic Capital at 99.9% confidence, sector concentration contribution to portfolio loss

**Regulatory reference:** Basel III Internal Ratings-Based (IRB) Approach for credit capital; Basel II correlation factor formula for retail and corporate portfolios

---

#### Module 3.4: CreditMetrics-Style Migration Analysis

**Mathematical foundation:**

Transition matrix for credit migration:

```
P[i→j] = P(rating migrates from i to j over horizon T)

Portfolio value distribution:
V(T) = Σ[i] V_i(rating_i(T)) × PV_i(spread_i(rating_i(T)))
```

Rating migrations simulated via correlated multivariate normal threshold model. Portfolio mark-to-market change distribution computed from migration outcomes.

**Output:** Expected and unexpected loss from credit migration, credit VaR at 95% and 99% confidence, sector migration analysis

**Regulatory reference:** Basel II/III Advanced IRB; credit risk capital allocation

---

#### Module 3.5: Concentration Risk

**Regulatory capital add-on for concentration risk:**

```
Herfindahl-Hirschman Index (HHI) = Σ[i] (s_i)² × 10,000

where s_i = exposure_i / total_exposure

Single-name concentration: Granularity Adjustment (GA):
GA = (1/(2×n)) × Σ[i] (s_i²)  / (EL × capital_ratio)
```

**Output:** HHI by sector, geography, and single-name; top-10 concentration report; regulatory capital concentration add-on estimate; board alert for exposures >10% of capital

**Regulatory reference:** NCUA 12 CFR Part 723 (Member Business Lending); Basel III Supervisory Formula Approach granularity adjustment; COSSEC concentration limit guidance

---

#### Module 3.6: Wrong-Way Risk

Wrong-way risk arises when counterparty creditworthiness is negatively correlated with the value of the exposure — i.e., the exposure increases precisely when the counterparty is most likely to default.

**Mathematical foundation:**

```
General Wrong-Way Risk adjustment:
CVA_WWR = CVA_base × (1 + ρ × √(σ_credit × σ_exposure))

where ρ = correlation between counterparty credit quality and exposure value
```

**Output:** Wrong-way risk flag for counterparty exposures, CVA adjustment factors, stress test showing WWR impact under credit spread widening + exposure increase scenarios

**Regulatory reference:** Basel III CVA risk capital; BCBS Wrong-Way Risk guidance (2011)

---

### SUITE 4: LIQUIDITY (4 Modules)

**Regulatory anchor:** Basel III LCR/NSFR, NCUA 12 CFR Part 741 (Liquidity), COSSEC liquidity requirements

---

#### Module 4.1: LCR/NSFR

**LCR Mathematical foundation:**

```
LCR = HQLA / Total_Net_Cash_Outflows_30day ≥ 100%

HQLA = Level_1 + 0.85 × Level_2A + 0.50 × Level_2B (capped at 15% of HQLA)

Net_Cash_Outflows = Σ[i] CF_outflow_i × runoff_rate_i - min(0.75 × CF_inflows, 0.75 × CF_outflows)
```

Deposit outflow rates by type:
- Stable retail deposits (fully insured, established relationship): 3%
- Less stable retail deposits: 10%
- SME operational deposits: 25%
- Non-financial wholesale: 40%
- Financial institution wholesale: 100%
- Collateralized funding (HQLA): 0-25%

**NSFR Mathematical foundation:**

```
NSFR = Available_Stable_Funding / Required_Stable_Funding ≥ 100%

ASF = Σ[i] Funding_i × ASF_factor_i
RSF = Σ[j] Asset_j × RSF_factor_j
```

**Output:** LCR ratio, HQLA composition, net cash outflow schedule (daily for 30 days), NSFR ratio, ASF/RSF breakdown, breach flags and remediation suggestions

**Regulatory reference:** BCBS Basel III LCR Final Rule (2013); BCBS NSFR Final Rule (2014); COSSEC Circular 2021-01 Liquidity Requirements; NCUA 12 CFR 741.12

---

#### Module 4.2: Cash Flow Bucketing

Deterministic cash flow schedule across time buckets:

```
Time buckets: 1D, 2-7D, 8-30D, 31-90D, 91-180D, 181-365D, 1-2Y, 2-5Y, 5+Y

Net_CF(bucket) = CF_Inflows(bucket) - CF_Outflows(bucket)
Cumulative_CF(T) = Σ[t≤T] Net_CF(t)
```

Incorporates:
- Contractual cash flows (loan repayments, bond maturities, deposit maturities)
- Behavioral assumptions (prepayment rates, deposit renewal rates, drawdown rates)
- Contingent cash flows (off-balance-sheet commitments, guarantees)

**Output:** Cash flow ladder table, cumulative funding gap, break-even funding rate by bucket

**Regulatory reference:** BCBS LCR cash flow methodology; COSSEC cash flow stress test requirements

---

#### Module 4.3: SOFR Exposure

SOFR (Secured Overnight Financing Rate) transition analysis:

- Outstanding LIBOR-referenced instruments with conversion timeline
- SOFR exposure by maturity and product type
- SOFR basis risk: spread between SOFR and other benchmark rates
- ISDA SOFR fallback provisions compliance check
- Term SOFR vs. Compounded SOFR product mapping

**Output:** LIBOR/SOFR transition inventory, basis risk quantification, fallback provision gap analysis

**Regulatory reference:** ARRC SOFR Transition Recommendations; SEC guidance on LIBOR transition disclosures; COSSEC SOFR circular

---

#### Module 4.4: Deposit Beta

**Mathematical foundation:**

Deposit Beta measures the pass-through rate of policy rate changes to deposit rates:

```
β_deposit = ΔDeposit_Rate / ΔFed_Funds_Rate

Estimated via OLS regression with lagged effects:
ΔDeposit_Rate(t) = α + β₁ × ΔFF(t) + β₂ × ΔFF(t-1) + β₃ × ΔFF(t-2) + ε(t)

Cumulative beta (through cycle):
β_cumulative = β₁ + β₂ + β₃
```

Institution-specific Deposit Beta is calibrated from the institution's own historical rate data when available (≥8 quarters). Sector averages are used for new institutions or when history is insufficient.

**Behavioral duration from Deposit Beta:**

```
D_NMD = 1 / (β_deposit × r_base)
```

**Output:** Deposit Beta by product type (savings, money market, CDs), cumulative beta estimate, confidence interval, comparison to sector average, NII sensitivity re-run using institution-calibrated beta

**Regulatory reference:** Federal Reserve SR Letter 10-6 (NMD modeling); FFIEC Rate Sensitivity Guidance; COSSEC NMD behavioral assumptions guidance

---

### SUITE 5: PORTFOLIO OPTIMIZATION (5 Modules)

**Regulatory anchor:** NCUA 12 CFR Part 703 (Investment Policy), Basel III Internal Capital Adequacy Assessment Process (ICAAP)

---

#### Module 5.1: Black-Litterman Optimization

Full Black-Litterman implementation (detailed in Section 2.6). Production capabilities:

- Equilibrium return estimation via reverse optimization from market weights
- View specification interface: relative and absolute return views
- Confidence parameterization via view uncertainty matrix Ω
- Constraint set: duration limits, credit quality minimums, sector maximums, NCUA Part 703 compliance
- Output: optimal weight vector with posterior return/risk statistics, efficient frontier visualization

---

#### Module 5.2: Hierarchical Risk Parity

Full HRP implementation (detailed in Section 2.7). Production capabilities:

- Dendrogram visualization showing asset clustering structure
- Risk contribution by asset and cluster
- Side-by-side comparison: HRP vs. EW vs. Markowitz vs. Risk Parity
- Rolling backtest: HRP performance over 3-year historical window
- Rebalancing trigger: alert when current weights deviate >5% from HRP optimal

---

#### Module 5.3: Capital Optimizer

**Mathematical foundation:**

Optimization of capital allocation across business lines or regulatory capital buckets:

```
Maximize: Σ[i] RAROC_i × w_i

Subject to:
  Σ[i] w_i × RWA_i ≤ Capital_available
  w_i ≥ 0 for all i
  Σ[i] w_i = 1
  Constraint set (concentration limits, minimum allocations)

RAROC_i = (Revenue_i - Expected_Loss_i - OpEx_i) / Economic_Capital_i
```

Solved via sequential quadratic programming (SQP) with constraint handling.

**Output:** Optimal capital allocation by business line, marginal RAROC, shadow prices on binding constraints, scenario analysis of capital plan alternatives

---

#### Module 5.4: CVaR Optimizer

**Mathematical foundation:**

Conditional Value at Risk (CVaR, also called Expected Shortfall) minimization:

```
min CVaR_α(w) = min[ξ + (1/(1-α)) × E[max(-R(w) - ξ, 0)]]

where:
R(w) = portfolio return = w^T × r
α = confidence level (typically 95% or 99%)
ξ = VaR threshold (optimization variable)
```

This is the Rockafellar-Uryasev (2000) linear programming formulation, which makes CVaR optimization tractable as a linear program.

**Why CVaR over VaR for regulators:**

VaR answers: "What is the minimum loss in the worst X% of scenarios?"
CVaR answers: "What is the average loss in the worst X% of scenarios?"

CVaR is a coherent risk measure (satisfies subadditivity): the CVaR of a combined portfolio is never worse than the sum of individual CVaRs. VaR does not satisfy this property. This makes CVaR appropriate for capital allocation and regulatory purposes.

Basel III moved from VaR to ES (Expected Shortfall = CVaR) under FRTB for exactly this reason.

**Output:** CVaR-optimal portfolio weights, CVaR contribution by position, efficient CVaR frontier, comparison to VaR-optimal portfolio

---

#### Module 5.5: VaR (Value at Risk)

**Three methods implemented:**

**1. Historical Simulation:**
```
VaR_α = -Percentile(R_1, ..., R_T; 1-α)
```
Uses observed returns directly — no parametric assumption. Requires 250 days of return history minimum (Basel III backtesting requirement).

**2. Parametric (Normal):**
```
VaR_α = μ - z_α × σ

where z_α = 1.645 (95%), 2.326 (99%), 2.576 (99.9%)
```
Fast and tractable; assumes normality. Underestimates tail risk for fat-tailed distributions.

**3. Monte Carlo:**
```
Simulate 10,000 portfolio return paths
VaR = -5th percentile of simulated distribution
CVaR = -Mean of bottom 5% of simulated distribution
```

**Output:** VaR at 95% and 99% confidence, 1-day and 10-day horizons, VaR decomposition by position, backtesting results (Kupiec test statistic), conditional on confidence interval holding

**Regulatory reference:** Basel III market risk capital calculation; FRTB backtesting requirements; NCUA investment risk management guidance

---

### SUITE 6: REGULATORY COMPLIANCE (6 Modules)

**Regulatory anchor:** COSSEC regulations, NCUA 12 CFR, Basel III/IV, Act 81 (Puerto Rico cooperative law)

---

#### Module 6.1: COSSEC Compliance

Automated compliance checking against current COSSEC regulatory thresholds:

| Metric | Regulatory Threshold | CERNIQ Check |
|---|---|---|
| Duration Gap | ≤ 3.0 years | Automated RED/YELLOW/GREEN |
| NII Sensitivity (±300bp) | ≤ ±20% | Automated threshold flag |
| EVE Sensitivity (±300bp) | ≤ -25% of CET1 | Automated threshold flag |
| LCR | ≥ 100% | Automated compliance check |
| Capital Ratio (Tier 1) | ≥ 6% | Automated compliance check |
| Concentration (single name) | ≤ 15% of capital | Automated breach alert |

Auto-generates COSSEC examination response narrative in Spanish when thresholds are breached — saves 10-20 hours of management writing time per finding.

---

#### Module 6.2: NCUA Form 5300 Mapper

Maps CERNIQ-computed metrics directly to NCUA Call Report (Form 5300) Schedule E (Interest Rate Risk) and Schedule F (Liquidity):

- Automated population of Schedule E NII sensitivity table
- Automated population of Schedule F liquidity ratios
- Cross-validation: CERNIQ computations vs. call report as-filed values
- Discrepancy alert: flags differences >5bps between models and call report

**Regulatory reference:** NCUA Form 5300 Instructions; NCUA IRR Disclosure requirements effective 2023

---

#### Module 6.3: Exam Prep Suite

Complete examination preparation toolkit:

1. **Model documentation package**: Auto-generated model documentation for every ALM module in use, formatted for examiner review (model description, inputs, methodology, limitations, validation history)
2. **Policy alignment checker**: Compares current ALM policy document (uploaded by institution) against NCUA/COSSEC minimum policy requirements
3. **Finding remediation tracker**: Documents prior examination findings, current remediation status, and supporting evidence
4. **Examiner talking points**: For each metric, generates narrative explanation appropriate for ALM Committee presentation to examiners
5. **Pre-examination checklist**: 48-item checklist covering every area of IRR, liquidity, and credit risk examination scope

---

#### Module 6.4: Board Report Generator

14-page board-ready PDF report generation — the core CERNIQ product. Report structure:

| Section | Content | Language |
|---|---|---|
| 1 | Executive Summary Dashboard | ES/EN |
| 2 | Balance Sheet Overview | ES/EN |
| 3 | Duration Gap Analysis | ES/EN |
| 4 | NII Sensitivity (12-month) | ES/EN |
| 5 | EVE Analysis | ES/EN |
| 6 | Monte Carlo Simulation | ES/EN |
| 7 | Liquidity Ratios (LCR/NSFR) | ES/EN |
| 8 | Cash Flow Analysis | ES/EN |
| 9 | Credit Risk Summary (CECL) | ES/EN |
| 10 | Investment Portfolio Analysis | ES/EN |
| 11 | Stress Test Results | ES/EN |
| 12 | Regulatory Compliance Status | ES/EN |
| 13 | Board Action Items | ES/EN |
| 14 | Model Documentation Appendix | ES/EN |

Output: AES-256-GCM encrypted PDF, cryptographically sealed with input hash and generation timestamp. Board-quality typography, charts, and executive summary in both English and Spanish.

---

#### Module 6.5: CAMEL Forecast

Predictive CAMEL (Capital, Assets, Management, Earnings, Liquidity) rating model:

```
CAMEL_composite = w_C × Score_C + w_A × Score_A + w_M × Score_M + w_E × Score_E + w_L × Score_L

where scores 1-5 (1=best, 5=worst) are mapped from financial metrics via regulatory threshold calibration
```

CAMEL scores forecast for 1, 2, and 4 quarters forward using trend extrapolation and scenario conditioning. Designed to give boards early warning of CAMEL deterioration before examinations.

**Regulatory reference:** NCUA CAMEL Rating System (2015); COSSEC examination ratings framework

---

#### Module 6.6: Act 81 Compliance (Puerto Rico)

Act 81 of 2009 — Puerto Rico's updated Cooperative Associations Act — specifies governance and financial requirements unique to COSSEC-regulated cooperativas. This module checks:

- Statutory reserve fund requirements (minimum 10% of net assets)
- Dividend distribution restrictions based on capital levels
- Member loan concentration limits
- Annual meeting financial disclosure requirements
- Board financial literacy certification tracking

**Global equivalents:**

| Jurisdiction | Equivalent Regulatory Module |
|---|---|
| US Credit Unions | NCUA Federal Credit Union Act compliance |
| Mexico (SOFIPO) | CNBV Ley de Ahorro y Crédito Popular |
| Colombia | SFC Decreto 2555 solidaria sector |
| UK Building Societies | Building Societies Act 1986 compliance |
| Germany Volksbanken | BaFin GenG (Genossenschaftsgesetz) |

---

### SUITE 7: ADVANCED ANALYTICS (5 Modules)

**Regulatory anchor:** Basel III/IV Pillar 2 Internal Capital Adequacy, TCFD Climate Risk Disclosure

---

#### Module 7.1: PCA Yield Curve Analysis

**Mathematical foundation:**

Principal Component Analysis decomposes yield curve movements into orthogonal factors. For a T×N matrix of historical yield changes (T time periods, N maturities):

```
Covariance matrix: Σ = (1/T) × X^T × X

Eigendecomposition: Σ = Q × Λ × Q^T

where columns of Q are eigenvectors (principal components)
and Λ is diagonal matrix of eigenvalues
```

**The Three-Factor Interpretation:**

Empirically, 3 principal components explain 95-99% of yield curve variance:

- **PC1 (Level)**: All yields move together. Explains ~80% of variance. Corresponds to parallel shift.
- **PC2 (Slope)**: Short rates move opposite to long rates. Explains ~10-15% of variance. Corresponds to steepener/flattener.
- **PC3 (Curvature)**: Short and long rates move together, medium rates move opposite. Explains ~3-5% of variance. Corresponds to butterfly movement.

```
Factor loadings (illustrative for 2-year, 5-year, 10-year maturities):
       2Y     5Y    10Y
PC1: [0.52, 0.57, 0.64]   ← parallel
PC2: [0.62, 0.11, -0.70]  ← slope
PC3: [0.56, -0.79, 0.28]  ← curvature
```

**Portfolio PCA sensitivity:**

```
Portfolio_PCA_sensitivity = [KRD_vector] × [PC_loading_matrix]

PC1_sensitivity = Σ[τ] KRD(τ) × PC1_loading(τ)
PC2_sensitivity = Σ[τ] KRD(τ) × PC2_loading(τ)
PC3_sensitivity = Σ[τ] KRD(τ) × PC3_loading(τ)
```

This decomposes portfolio interest rate risk into level, slope, and curvature risk — enabling targeted hedging.

**Output:** PC1/PC2/PC3 sensitivity of institution's balance sheet, variance explained chart, historical PC realization chart, scenario generator using PC-based parameterization

**Regulatory reference:** BCBS IRRBB (2016) requires non-parallel curve analysis; PCA is the industry-standard approach for this decomposition

---

#### Module 7.2: Macro Regime Detection

**Mathematical foundation:**

Hidden Markov Model (HMM) for interest rate regime identification:

```
States: S = {Bull_Flattening, Bear_Steepening, Crisis, Neutral}

Transition matrix A:
A_ij = P(State_t+1 = j | State_t = i)

Emission distribution:
P(y_t | State_t = k) = N(μ_k, Σ_k)

where y_t = (ΔRate_2Y, ΔRate_10Y, ΔCredit_Spread, ΔEquity_Vol)
```

**Viterbi algorithm** decodes the most likely state sequence given observed data. **Baum-Welch algorithm** (Expectation-Maximization) calibrates model parameters.

**Regime-conditional ALM strategy:**

| Detected Regime | Recommended ALM Response |
|---|---|
| Bear Steepening (rising rates, steepening curve) | Shorten asset duration, float-rate product emphasis |
| Bull Flattening (falling rates, flattening curve) | Extend asset duration, lock in long rates |
| Crisis (spread widening, volatility spike) | Increase HQLA, reduce credit risk, maximize liquidity |
| Neutral | Standard ALM management, monitor regime signals |

**Output:** Current regime probability distribution, regime history chart, ALM strategy recommendation per regime, regime-conditioned NII and EVE projections

---

#### Module 7.3: NIM Attribution

Net Interest Margin decomposition analysis:

```
NIM = (Interest_Income - Interest_Expense) / Average_Earning_Assets

NIM Attribution:
  ΔNIM = ΔRate_effect + ΔVolume_effect + ΔMix_effect + ΔSpread_effect

Rate effect:  = (Current_Rate - Prior_Rate) × Prior_Volume
Volume effect: = (Current_Volume - Prior_Volume) × Prior_Rate
Mix effect:   = (Current_Mix - Prior_Mix) × Blended_Rate_differential
Spread effect: = Change in asset-liability spread × Volume
```

**Output:** NIM attribution waterfall chart (quarter-over-quarter and year-over-year), driver identification (is NIM declining due to rate compression, volume, or mix shift?), peer comparison benchmark

---

#### Module 7.4: FTP (Funds Transfer Pricing) Attribution

**Mathematical foundation:**

FTP assigns a cost of funds to each asset and a credit for funds to each liability, enabling product-line profitability analysis:

```
Loan Contribution Margin = Loan_Rate - FTP_Cost_of_Funds(duration) - Expected_Credit_Loss - OpEx

FTP_Rate(asset) = Risk_Free_Rate(maturity) + Liquidity_Premium(maturity) + Basis_Spread

FTP_Credit(deposit) = Risk_Free_Rate(behavioral_duration) + Liquidity_Value(deposit_stability)
```

**Matched-maturity FTP:**

Each asset is matched to a funding instrument of equal maturity on the theoretical funding curve. This separates:
- Interest rate risk income (taken on by Treasury/ALM function)
- Credit risk income (retained by lending business line)
- Liquidity value (managed centrally)

**Output:** FTP rate by product type and maturity, product-line P&L attribution, NIM by business line, FTP methodology documentation for examination

**Regulatory reference:** OCC Handbook Funds Transfer Pricing; FFIEC FTP guidance; Basel III ALM treasury separation principles

---

#### Module 7.5: Climate Risk (TCFD-Aligned)

**Physical risk scoring:**

```
Physical_Risk_Score = w₁ × Flood_Risk(geography) + w₂ × Hurricane_Risk(geography) +
                      w₃ × Sea_Level_Rise_Risk(proximity) + w₄ × Drought_Risk(climate_zone)

Collateral_Value_Adjustment = -Physical_Risk_Score × Property_Value × Sensitivity_Factor
```

For Puerto Rico cooperativas: Hurricane/flood risk is the dominant physical risk driver. Properties in FEMA flood zones carry elevated risk scores.

**Transition risk scoring:**

```
Transition_Risk = w₁ × Carbon_Intensity(industry) + w₂ × Regulatory_Exposure(jurisdiction) +
                  w₃ × Technology_Risk(sector) + w₄ × Market_Reputation_Risk(ESG_rating)
```

**TCFD alignment:**

Module maps to all four TCFD pillar requirements:
- Governance: Board risk oversight documentation templates
- Strategy: Climate scenario analysis (1.5°C, 2°C, 4°C pathways)
- Risk Management: Physical and transition risk integration into ALM framework
- Metrics & Targets: Portfolio carbon intensity, PCAF alignment score

**Output:** Climate risk score by loan segment and geography, collateral value at risk under physical scenarios, portfolio transition risk exposure, TCFD disclosure narrative

**Regulatory reference:** TCFD Final Recommendations (2017); NGFS Climate Scenarios for Central Banks; OCC Climate-Related Financial Risk guidance (2021); ECB climate stress test methodology (2022)

---

## 4. THE GLOBAL EXPANSION ARCHITECTURE

### 4.1 Current: Puerto Rico (COSSEC + NCUA)

CERNIQ is in production today serving COSSEC-regulated cooperativas in Puerto Rico. The platform is regulatory-native: every calculation threshold, report template, and examination checklist is calibrated to COSSEC and NCUA standards.

**Current capabilities:**
- 109 COSSEC-regulated cooperativas (full TAM)
- 40+ NCUA-regulated credit unions in Puerto Rico
- Bilingual (ES/EN) native support
- COSSEC examination format outputs
- Act 81 compliance module
- Puerto Rico-specific deposit behavior calibration

**Current pricing:**
- Small cooperativa (<$100M): $300/month
- Mid-market ($100M–$500M): $800/month
- Large (>$500M): $1,500–$5,000/month
- CPA firm multi-client: $3,000/month (up to 10 clients)

### 4.2 Phase 2: US Credit Union Sector (2026–2027)

**Market size:** 5,000+ NCUA-regulated credit unions, $2T+ combined assets

**Regulatory delta from current:**
- NCUA-specific report formats (Form 5300 Schedule E/F)
- DFAST applicability for credit unions >$10B assets
- US state supervisory equivalents (NASCUS-regulated state charters)
- English-primary (Spanish secondary for Hispanic-serving CUs)

**Architecture changes required:**
- NCUA Form 5300 full automation (60% complete at current state)
- US rate calibration (Fed Funds, SOFR, FHLB rates vs. PR-local rates)
- Peer benchmarking against NCUA Call Report aggregate data
- White-label product for CUNA Mutual Group, NAFCU partnership channel

**Revenue projection:** $2M–$5M ARR achievable within 24 months of Phase 2 launch

### 4.3 Phase 3: Latin American Cooperativas (2027–2028)

**Target markets:**

| Country | Regulatory Body | Institution Type | Market Size |
|---|---|---|---|
| Mexico | CNBV | SOFIPO, SOFOM, Caja Popular | 400+ institutions |
| Colombia | SFC (Superintendencia Financiera) | Cooperativas de ahorro y crédito | 200+ institutions |
| Chile | SBIF / CMF | Cajas de compensación | 50+ institutions |
| Ecuador | SEPS | Cooperativas de ahorro y crédito | 600+ institutions |
| Peru | SBS | CRAC, CMAC, COOPAC | 300+ institutions |

**Architecture changes required per jurisdiction:**

1. **Data model adaptation:**
   - Multi-currency balance sheets (MXN, COP, CLP, etc.)
   - Local regulatory asset weight tables (different RWA frameworks)
   - Inflation-indexed instrument support (UDIS in Mexico, UF in Chile)

2. **Regulatory report format:**
   - CNBV R04C format (Mexico) vs. COSSEC quarterly report
   - SFC CUIF (Colombia) financial information format
   - CMF N°43 (Chile) financial reporting standard

3. **Language layer:**
   - Spanish dialects: Mexico, Colombia, Chile have distinct terminology for financial instruments
   - Portuguese: Brazil expansion requires full PT-BR translation
   - Current bilingual framework in CERNIQ is already architected for multi-locale extension

4. **Local compliance modules:**
   - Mexico: CNBV SOFIPO regulatory capital rules, captive reserve requirements
   - Colombia: SFC RAS (Riesgo de Activos y Seguros) capital framework
   - Chile: CMF LBR (Ley de Bancos y Regulación) liquidity requirements

**Architecture decisions already supporting this:**

- **Translation provider pattern**: `lib/alm/labels.ts` uses a key-based translation system extensible to any locale without code changes to calculation modules
- **Multi-tenant RBAC**: `OWNER/ANALYST/VIEWER` roles per institution, fully isolated data tenants — adding a Mexican institution requires no architectural change
- **Decimal precision**: Universal — not region-specific, works for any currency
- **Stripe global billing**: Available in 190 countries, supports 135+ currencies

### 4.4 Phase 4: Community Banks Globally (2028+)

**Target markets:**

| Country/Region | Institution Type | Regulatory Framework | Institutions |
|---|---|---|---|
| United Kingdom | Building Societies | PRA SS31/15, IRRBB | 43 institutions |
| Germany | Volksbanken, Raiffeisenbanken | BaFin, CRR/CRD IV | 800+ institutions |
| France | Caisse d'Épargne, Crédit Mutuel | ACPR, CRR/CRD IV | 500+ institutions |
| Australia | Credit Unions, Mutual Banks | APRA APS117 | 60+ institutions |
| Canada | Credit Unions | OSFI E-19, Provincial regulators | 250+ institutions |

**Regulatory adapter architecture:**

CERNIQ's engine is regulatory-agnostic. The calculation layer (Duration Gap, NII Sensitivity, EVE, etc.) produces mathematically correct outputs independent of jurisdiction. Regulatory compliance is implemented as an adapter layer:

```
ALM Engine (jurisdiction-independent)
         ↓
Regulatory Adapter (jurisdiction-specific)
         ↓
Report Template (regulator-specific format)
```

Adding a new jurisdiction requires:
1. New regulatory threshold configuration (JSON file)
2. New report template (PDF template definition)
3. New compliance module (optional — for jurisdiction-specific checks)
4. Translation layer extension (new locale strings)

No changes to the ALM calculation engine.

---

## 5. THE NO-BRAINER ROI CALCULATOR

### 5.1 ROI Framework

CERNIQ's value to any financial institution can be computed precisely from three inputs:

| Input | Description |
|---|---|
| Institution asset size | Determines CERNIQ tier pricing |
| Current ALM spend | Consultant fees + internal analyst time + overhead |
| Quarterly report frequency | Typically 4x/year (quarterly + annual) |

### 5.2 Worked Examples

---

**Example A: Small Cooperativa ($50M Assets)**

| Item | Detail | Annual Value |
|---|---|---|
| CERNIQ cost | $300/month | $3,600/year |
| Prior consultant cost | $3,500/quarter | $14,000 eliminated |
| Prior analyst time | 40 hrs/quarter × $25/hr | $4,000 eliminated |
| Exam prep time | 80 hrs/year × $25/hr | $2,000 eliminated |
| **Total savings** | | **$20,000/year** |
| **Annual CERNIQ cost** | | **$3,600/year** |
| **Net annual benefit** | | **$16,400/year** |
| **ROI** | | **456%** |
| **Payback period** | | **2.2 months** |
| **5-year NPV (10% discount rate)** | | **$62,000** |

---

**Example B: Mid-Market Credit Union ($500M Assets)**

| Item | Detail | Annual Value |
|---|---|---|
| CERNIQ cost | $1,500/month | $18,000/year |
| Prior consultant cost | $10,000/quarter | $40,000 eliminated |
| Prior analyst time | 60 hrs/quarter × $35/hr | $8,400 eliminated |
| Exam prep (independent validation avoided) | $25,000 eliminated | $25,000 eliminated |
| Staff overtime (quarterly rush) | $5,000 eliminated | $5,000 eliminated |
| **Total savings** | | **$78,400/year** |
| **Annual CERNIQ cost** | | **$18,000/year** |
| **Net annual benefit** | | **$60,400/year** |
| **ROI** | | **336%** |
| **Payback period** | | **2.8 months** |
| **5-year NPV (10% discount rate)** | | **$229,000** |

---

**Example C: Large Institution ($2B Assets)**

| Item | Detail | Annual Value |
|---|---|---|
| CERNIQ cost | $5,000/month | $60,000/year |
| Prior ALM consultant spend | $150,000/year eliminated | $150,000 eliminated |
| Prior ALM staff (0.5 FTE) | $50,000 redeployed | $50,000 redeployed |
| Independent model validation (reduced scope) | $30,000 saved | $30,000 saved |
| Board report production | $15,000 saved | $15,000 saved |
| **Total savings** | | **$245,000/year** |
| **Annual CERNIQ cost** | | **$60,000/year** |
| **Net annual benefit** | | **$185,000/year** |
| **ROI** | | **308%** |
| **Payback period** | | **3.9 months** |
| **5-year NPV (10% discount rate)** | | **$701,000** |

---

**Example D: CPA Firm (10 Cooperativa Clients)**

| Item | Detail | Annual Value |
|---|---|---|
| CERNIQ cost (multi-client tier) | $3,000/month | $36,000/year |
| Prior manual ALM hours | 10 clients × 80 hrs/quarter × $75/hr | $240,000 consumed |
| CERNIQ hours for same work | 10 clients × 8 hrs/quarter × $75/hr | $24,000 consumed |
| **Hours saved** | 720 hours/year | **$216,000 saved** |
| **Net annual benefit** | | **$180,000/year** |
| **ROI** | | **500%** |
| **Payback period** | | **2.4 months** |
| **5-year NPV (10% discount rate)** | | **$682,000** |

Additionally: CPA firm can take on 3–5 additional cooperativa clients with saved capacity, generating $150,000–$300,000 in incremental annual billing revenue.

---

### 5.3 The Cost of Non-Compliance

The ROI calculation above excludes the single largest line item: the cost of a regulatory examination finding.

**NCUA/COSSEC examination finding cost breakdown:**

| Cost Component | Typical Range |
|---|---|
| Management time (remediation plan, examiner meetings) | $25,000–$75,000 |
| Independent model validation (mandated by examiner) | $25,000–$75,000 |
| External consultant (remediation support) | $15,000–$50,000 |
| Board special sessions (governance findings) | $5,000–$15,000 |
| Ongoing quarterly progress reporting to examiner | $5,000–$20,000/year |
| **Total per finding cycle** | **$75,000–$235,000** |

A single IRR examination finding — the most common finding type for community financial institutions — costs more than CERNIQ's annual subscription at any pricing tier, for every institution size.

CERNIQ does not guarantee examination outcomes. But CERNIQ produces the documentation, calculations, and board reporting evidence that transforms an examiner conversation from adversarial to collaborative. Institutions with CERNIQ-backed ALM programs arrive at examinations with model documentation, quarterly board report history, and scenario analysis ready for review. This is the difference between a finding and a commendation.

---

## 6. THE IMPLEMENTATION PLAYBOOK

### 6.1 Day 1: First Report in Under an Hour

CERNIQ's onboarding is designed around a single principle: get to the first report before the first meeting ends.

**Hour 0–1: Account setup and first upload**

1. Create organization account (5 minutes)
2. Set institution parameters: name, charter type, regulatory regime (5 minutes)
3. Download the CERNIQ CSV template (1 minute)
4. Map institution balance sheet to template (15–30 minutes for first time)
5. Upload CSV — CERNIQ validates the file and runs data quality checks (2 minutes)
6. Trigger report generation — 14-page board PDF generated in under 5 minutes
7. Download and review first report

**Zero configuration required for first report.** CERNIQ uses regulatory-standard defaults for all model parameters on first run. Institution-specific calibration is optional and recommended for production use, but not required to get meaningful output immediately.

### 6.2 The CERNIQ CSV Schema (Balance Sheet Input Format)

CERNIQ accepts balance sheet data in a standardized 5-file CSV format:

**File 1: Loans (`loans.csv`)**

| Column | Type | Description | Example |
|---|---|---|---|
| instrument_id | VARCHAR(50) | Unique loan identifier | LN-2024-00142 |
| product_type | ENUM | MORTGAGE, AUTO, CONSUMER, COMMERCIAL, STUDENT | MORTGAGE |
| outstanding_balance | DECIMAL(20,6) | Current outstanding balance | 245000.000000 |
| original_balance | DECIMAL(20,6) | Balance at origination | 300000.000000 |
| origination_date | DATE | YYYY-MM-DD | 2021-03-15 |
| maturity_date | DATE | YYYY-MM-DD | 2051-03-15 |
| rate_type | ENUM | FIXED, VARIABLE, HYBRID | FIXED |
| coupon_rate | DECIMAL(10,6) | Annual interest rate (decimal) | 0.030000 |
| repricing_frequency | INTEGER | Months between repricing (0 for fixed) | 0 |
| risk_rating | INTEGER | Internal rating 1-10 (1=best) | 2 |
| collateral_type | ENUM | REAL_ESTATE, AUTO, UNSECURED, OTHER | REAL_ESTATE |

**File 2: Investments (`investments.csv`)**

| Column | Type | Description | Example |
|---|---|---|---|
| instrument_id | VARCHAR(50) | Unique security identifier | UST-2024-007 |
| cusip | VARCHAR(9) | CUSIP identifier | 912828YK0 |
| security_type | ENUM | UST, AGENCY, MBS, MUNICIPAL, CORP, CD | UST |
| par_value | DECIMAL(20,6) | Face/par value | 1000000.000000 |
| book_value | DECIMAL(20,6) | Amortized cost basis | 985000.000000 |
| market_value | DECIMAL(20,6) | Current fair market value | 975000.000000 |
| coupon_rate | DECIMAL(10,6) | Annual coupon rate | 0.025000 |
| maturity_date | DATE | YYYY-MM-DD | 2029-06-30 |
| purchase_date | DATE | YYYY-MM-DD | 2022-01-15 |
| duration | DECIMAL(10,6) | Modified duration (if known) | 4.820000 |

**File 3: Deposits (`deposits.csv`)**

| Column | Type | Description | Example |
|---|---|---|---|
| product_type | ENUM | SAVINGS, CHECKING, MONEY_MARKET, CD_3M, CD_6M, CD_1Y, CD_2Y, CD_3Y, CD_5Y, IRA | SAVINGS |
| balance | DECIMAL(20,6) | Total outstanding balance | 45000000.000000 |
| average_rate | DECIMAL(10,6) | Weighted average rate paid | 0.005000 |
| number_of_accounts | INTEGER | Count of accounts in category | 8542 |
| maturity_date | DATE | For CDs: maturity date (NULL for non-maturity) | NULL |
| early_withdrawal_rate | DECIMAL(10,6) | Estimated annual runoff rate | 0.080000 |

**File 4: Borrowings (`borrowings.csv`)**

| Column | Type | Description | Example |
|---|---|---|---|
| instrument_id | VARCHAR(50) | Unique borrowing identifier | FHLB-2024-001 |
| lender | VARCHAR(100) | Lender name/type | Federal Home Loan Bank |
| balance | DECIMAL(20,6) | Outstanding balance | 5000000.000000 |
| rate | DECIMAL(10,6) | Current interest rate | 0.042000 |
| maturity_date | DATE | Final maturity | 2026-12-31 |
| rate_type | ENUM | FIXED, VARIABLE | FIXED |

**File 5: Capital and Off-Balance-Sheet (`capital_obs.csv`)**

| Column | Type | Description | Example |
|---|---|---|---|
| tier1_capital | DECIMAL(20,6) | Tier 1 regulatory capital | 12500000.000000 |
| total_capital | DECIMAL(20,6) | Total regulatory capital | 14000000.000000 |
| rwa | DECIMAL(20,6) | Risk-weighted assets | 95000000.000000 |
| loan_commitments | DECIMAL(20,6) | Unfunded loan commitments | 3200000.000000 |
| standby_lcs | DECIMAL(20,6) | Standby letters of credit | 500000.000000 |

### 6.3 Data Validation: What CERNIQ Checks

Before running any calculation, CERNIQ validates:

1. **Schema completeness**: All required columns present, no blank required fields
2. **Type validation**: Rates are decimal fractions (0.035, not 3.5%), dates in YYYY-MM-DD format, balances positive
3. **Balance sheet consistency**: Total assets = total liabilities + capital (within 0.1% tolerance)
4. **Reasonableness checks**: Rate outlier detection (rates >25% or <0% flagged), maturity date logic (maturity > origination), balance magnitude checks
5. **Regulatory completeness**: Capital fields required for EVE/capital ratio calculations; flagged as warnings if absent

**Error messages are in plain language:**

```
ERROR: Loan LN-2024-00142 has a maturity date (2019-03-15) before its origination date (2021-03-15).
Please check and correct this record before reprocessing.

WARNING: 3 loans have coupon rates above 20%. Please verify these are correct
(possible data entry error: rate should be entered as 0.20, not 20.0).

INFO: Capital data not provided. EVE sensitivity as % of CET1 will not be computed.
All other metrics will calculate normally.
```

No cryptic error codes. No developer stack traces. Every error message tells the CFO or analyst exactly what to fix and how.

### 6.4 Quarterly Production Cycle

**Week 1 of each quarter:**
- Download balance sheet data from core banking system
- Map to CERNIQ CSV format (automated after first quarter — templates saved)
- Upload to CERNIQ
- Review automated data validation results
- Trigger report generation (5 minutes of processing)

**Week 2:**
- Review draft board report with ALM Committee
- Adjust institution-specific assumptions if warranted (deposit beta, prepayment speeds)
- Generate final board report version

**Week 3:**
- Board presentation using CERNIQ-generated materials
- Archive signed board minutes referencing CERNIQ report
- File COSSEC/NCUA required metrics if applicable

**Week 4:**
- If examination cycle active: pull Exam Prep Suite materials
- Generate examiner-ready model documentation package
- Review prior examination findings against current metric levels

**Total finance team time: 4–8 hours per quarter** (versus 40–80 hours manually)

---

## 7. THE ENGINEERING QUALITY GUARANTEE

### 7.1 Test Coverage Standards

CERNIQ maintains strict test coverage targets enforced in CI/CD:

| Component | Coverage Target | Test Type |
|---|---|---|
| ALM calculation modules | 80% minimum | Unit tests (pure function math validation) |
| API controllers | 70% minimum | Integration tests with test database |
| Data validation pipeline | 90% minimum | Unit tests (edge cases, boundary conditions) |
| Report generation | 75% minimum | Snapshot tests (PDF output determinism) |
| Authentication/Authorization | 95% minimum | Security-focused unit and integration tests |

ALM calculation unit tests validate mathematical correctness by:
1. Computing results against known closed-form solutions (Duration of par bond = maturity)
2. Cross-validating Monte Carlo results against analytical approximations (within 2% tolerance at 10,000 paths)
3. Regression testing against FFIEC model validation benchmark datasets

### 7.2 Decimal Precision Guarantee

**Formal guarantee:** Every financial output in every CERNIQ report reflects the exact value computed and stored as `DECIMAL(20,6)` in PostgreSQL. No float conversion occurs between storage and report rendering.

**Implementation verification:**
- TypeScript strict mode prevents implicit `number` coercion from Decimal objects
- ESLint rule flags any `parseFloat()` or `Number()` call in the calculation pipeline
- Database type verification: Prisma schema enforces `Decimal` type on all 46 financial fields
- PDF generation uses Decimal's `.toFixed(2)` for display, preserving full precision in storage

### 7.3 Report Immutability

Every CERNIQ report is cryptographically immutable after generation:

```
Report generation sequence:
1. Input files hashed: SHA-256(CSV_upload) → stored in report_metadata.input_hash
2. Parameters logged: all model parameters written to calculation_audit table
3. Calculations executed: all intermediate values stored in calculation_results
4. PDF generated: deterministic from stored calculation results
5. PDF hashed: SHA-256(PDF_bytes) → stored in report_metadata.output_hash
6. PDF uploaded to Cloudflare R2 with object immutability flag
7. Audit record sealed: no application path can modify report_metadata after generation
```

**Verification by regulator or auditor:**
- Request report from CERNIQ: receive PDF with embedded SHA-256 hash
- Verify hash against CERNIQ audit API: confirms PDF has not been modified
- Request parameter log: all calculation assumptions available for independent verification

### 7.4 Security Architecture

| Control | Implementation |
|---|---|
| Data encryption at rest | AES-256-GCM, institution-specific keys |
| Data encryption in transit | TLS 1.3 minimum |
| Authentication | Supabase JWT (RS256), session token rotation |
| Authorization | Multi-tenant RBAC (OWNER/ANALYST/VIEWER), enforced at API layer |
| Secrets management | Railway environment variables, never in code |
| SQL injection prevention | Prisma ORM parameterized queries only |
| Input sanitization | Zod schema validation on all API inputs |
| Rate limiting | Redis-backed rate limiting per institution and per user |
| Audit logging | Append-only audit log, all user actions timestamped |
| Penetration testing | Annual third-party penetration test (Wave 3 roadmap) |

### 7.5 Uptime and Infrastructure SLA

| Metric | Target | Architecture |
|---|---|---|
| API uptime | 99.9% (≤8.7 hours downtime/year) | Railway multi-instance, auto-restart |
| Frontend uptime | 99.9% | Vercel global CDN |
| Database availability | 99.95% | PostgreSQL with Railway managed backups |
| Report generation SLA | < 5 minutes for standard 14-page report | Asynchronous job queue with Redis |
| Backup frequency | Daily full + hourly incremental | Railway PostgreSQL managed backups |
| Recovery Time Objective (RTO) | < 4 hours | Documented restoration procedures |
| Recovery Point Objective (RPO) | < 1 hour | Hourly backup cadence |

### 7.6 Data Sovereignty Guarantee

**CERNIQ's explicit data commitments:**

1. Customer financial data is **never used for model training, benchmarking, or any purpose other than the customer's own reports**
2. Each institution's data is **fully isolated** at the database level (organization_id row-level security enforced by PostgreSQL RLS policies)
3. Report data is **retained for 7 years** (matching regulatory examination lookback requirements) and then securely deleted on customer request
4. CERNIQ staff access to customer data requires **explicit audit log entry** — no silent access
5. Data is stored on **US infrastructure** (Railway US region, Cloudflare US PoPs) with EU storage option available for European institutions

### 7.7 SOC 2 Type II Roadmap

| Milestone | Target | Description |
|---|---|---|
| SOC 2 Type I readiness | Wave 3 (Q3 2026) | Documentation, controls inventory, gap analysis |
| Third-party penetration test | Wave 3 (Q3 2026) | Annual external pentest, findings remediation |
| SOC 2 Type II audit period begins | Q4 2026 | 12-month audit observation period |
| SOC 2 Type II report issued | Q4 2027 | Attestation available to enterprise customers |

---

## 8. COMPETITIVE DESTRUCTION MATRIX

The following comparison reflects the honest state of the market as of 2026. CERNIQ does not claim competitors lack merit in all contexts. CERNIQ does claim that for community financial institutions seeking automated, bilingual, board-ready ALM reporting at institutional quality, no competitor matches the combination of capabilities CERNIQ delivers.

| Dimension | CERNIQ | Excel (Manual) | ALM Consultant | Legacy ALM Software (Plansmith, QRM, ZM Financial) |
|---|---|---|---|---|
| **Speed to report** | < 5 minutes | 2–6 weeks | 2–4 weeks | 1–3 days (setup: 6–12 months) |
| **Annual cost** | $3,600–$60,000 | $7,000–$50,000 (labor) | $15,000–$200,000 | $50,000–$500,000+ |
| **Setup time** | < 1 hour | N/A | 2–4 weeks per engagement | 6–18 months implementation |
| **Decimal arithmetic** | Yes (DECIMAL 20,6) | No (IEEE 754 float) | Depends on tool | Varies; most use float |
| **Monte Carlo (10K paths)** | Yes (Vasicek) | No | Sometimes | Yes (selected products) |
| **Key Rate Durations** | Yes (11 tenors) | Rarely | Sometimes | Yes (higher tiers) |
| **CECL Vintage Analysis** | Yes (ASC 326) | Manual builds | Sometimes | Yes (add-on) |
| **Black-Litterman** | Yes (native) | No | Rarely | Rarely |
| **HRP** | Yes (ML-based) | No | No | No |
| **KMV-Merton** | Yes (structural) | No | Specialized only | Rarely |
| **FRTB-IMA** | Yes (Basel IV) | No | Specialized only | Selected products only |
| **PCA Yield Curve** | Yes (3-factor) | No | Rarely | Rarely |
| **Macro Regime Detection** | Yes (HMM) | No | No | No |
| **Climate Risk (TCFD)** | Yes (native) | No | No | Emerging |
| **Bilingual (ES/EN)** | Yes (native) | No | Rarely | No |
| **Regulatory defensibility** | High (Decimal, audit trail, documentation) | Low (no audit trail, float math) | High (expert-backed) | Medium-High |
| **Audit trail** | Cryptographic immutability | None | Engagement files | Varies |
| **Board report quality** | 14-page PDF, bilingual, branded | Variable | High (manual polish) | High (customizable) |
| **Implementation burden** | Near-zero (CSV upload) | N/A | High (onboarding) | Very high (6–18 months) |
| **Maintenance burden** | Zero (SaaS) | High (manual updates) | N/A | High (upgrades, DBA) |
| **Multi-institution support** | Yes (CPA firm tier) | No | Per-engagement | With additional licenses |
| **API access** | Yes (REST API) | No | No | Limited |
| **On-premise option** | No (SaaS-first) | N/A | N/A | Yes (for very large FIs) |
| **Minimum viable institution size** | $10M assets | Any | $50M+ (economically) | $500M+ (economically) |
| **COSSEC/PR compliance** | Native | Build yourself | Some consultants | None (US-only products) |
| **NCUA compliance** | Native (Form 5300) | Manual mapping | Usually | Yes |
| **Basel III/IV alignment** | Yes (all frameworks) | Partial | Depends | Yes (higher tiers) |

**The verdict:**

- Against **Excel**: CERNIQ wins on every dimension that matters for regulatory examination. Excel has zero audit trail, float arithmetic, and no scenario management. It is not a defensible ALM platform.

- Against **ALM Consultants**: CERNIQ is 10–50x cheaper, delivers results in minutes instead of weeks, and produces a more auditable output. Consultants remain valuable for complex transactions and regulatory strategy — CERNIQ handles the quarterly reporting cycle that should never require a consultant.

- Against **Legacy ALM Software**: CERNIQ is dramatically cheaper, implements in hours not months, requires no on-premise infrastructure, includes capabilities (HRP, KMV-Merton, Macro Regime Detection) that most legacy platforms do not offer, and is the only bilingual platform purpose-built for the Hispanic cooperative finance sector. Legacy platforms are designed for large bank treasury departments — CERNIQ is designed for the 10,000+ community financial institutions that cannot afford the legacy alternative.

---

## 9. THE GLOBAL FINANCE TEAM MANIFESTO

### Finance Teams Deserve Better

There is a document that sits at the center of every community financial institution's risk management framework. It is called the Asset-Liability Management Report. It is produced once per quarter, reviewed at every board meeting, and scrutinized at every regulatory examination. It is the single most consequential analytical document the institution produces.

And at thousands of financial institutions across the world, it is built in Microsoft Excel.

This is not a criticism of the analysts who build it. These are skilled finance professionals who have adapted remarkable tools to regulatory requirements those tools were never designed to handle. They have built models of genuine sophistication from a blank grid. They have earned their expertise through years of careful, painstaking work.

This is an observation about a structural failure in the financial infrastructure market. The Bloomberg Terminal set the standard for institutional-grade financial data delivery in 1981. Core banking platforms modernized transaction processing. Trading systems automated execution. But the quarterly ALM report — the document that tells a $500M credit union whether it will survive a 300 basis point rate shock — has remained the domain of spreadsheets and manual consultants for decades.

Why? Not because the problem is unsolvable. Because the market segment was too fragmented, too specialized, and too multilingual for the incumbents to serve profitably. The large bank ALM platforms — Moody's Analytics, Kaufman Hall, QRM — are enterprise software designed for institutions with dedicated model risk teams and seven-figure software budgets. They are excellent tools for institutions that can afford them. They are inaccessible to the 10,000+ community financial institutions that collectively hold trillions in member assets and serve the financial needs of the most economically vulnerable communities in the world.

CERNIQ was built to close this gap.

### The Mathematics Must Be Correct

When a cooperativa's board of directors reviews a Duration Gap analysis showing 2.4 years, they are making decisions about lending policy, investment strategy, and capital allocation based on that number. When a credit union's ALM Committee reviews a Monte Carlo simulation showing 95% confidence that NII stays within ±15% of base case, they are assessing whether the institution can absorb a rate shock without triggering NCUA Prompt Corrective Action.

These numbers have consequences. A wrong Duration Gap means wrong risk assessment. A wrong Monte Carlo interval means false confidence or false alarm. A floating-point rounding error that shifts EVE by 0.3% might be the difference between a GREEN flag and a YELLOW examination flag.

CERNIQ's engineering philosophy starts from a single conviction: **the mathematics must be correct**.

This means Decimal arithmetic, not floating-point. It means 10,000 Monte Carlo paths, not 100. It means Key Rate Durations across 11 tenor points, not just a parallel shift assumption. It means CECL vintage analysis calibrated to FASB ASC 326, not a proxy ratio. It means Vasicek calibration from market-observable parameters, not textbook defaults.

Every design choice in CERNIQ's calculation engine was made by asking: "Would a model validator from the Federal Reserve or COSSEC accept this methodology?" If the answer was no, the implementation was rebuilt until it was yes.

This is not academic perfectionism. It is commercial necessity. A community financial institution that builds its quarterly board report on CERNIQ is staking its regulatory reputation on the correctness of CERNIQ's calculations. We take that responsibility seriously. The audit trail exists so that every number in every report can be traced back to the specific input, the specific parameter, and the specific calculation — and verified independently by any qualified reviewer.

### Regulators Deserve Defensible Work

The relationship between community financial institutions and their regulators is not adversarial by design. Regulators — NCUA examiners, COSSEC supervisors, OCC field staff — are professionals whose job is to protect depositors and members. Their examination findings are almost always legitimate observations about genuine risk management gaps.

The problem is not the examination process. The problem is that many institutions arrive at examinations without the analytical infrastructure to demonstrate that their ALM framework is sound. They have spreadsheets that produce numbers, but cannot easily document the methodology behind those numbers, the assumptions used, the scenarios tested, or the model limitations acknowledged.

This is where CERNIQ changes the examination dynamic. An institution using CERNIQ arrives at an examination with:

- A complete quarterly board report history (every quarter documented, immutable)
- Full model documentation for every ALM module in use (auto-generated by the Exam Prep Suite)
- Parameter logs showing every calibration assumption and its date
- Scenario analysis across all regulatory-required shock scenarios plus institution-defined custom scenarios
- A compliance status dashboard showing which metrics are within regulatory thresholds and which warrant discussion

This is the difference between an examiner who has to build a model risk opinion from scratch and an examiner who can verify a pre-built, documented analytical framework. CERNIQ does not guarantee examination outcomes. CERNIQ does guarantee that the institution walks into the examination room with the strongest possible analytical foundation.

### Boards Deserve Clarity

The board of directors of a community financial institution is not composed of quantitative finance PhDs. It is composed of professionals — business owners, attorneys, medical professionals, educators — who volunteered their expertise to govern an institution that serves their community. They are legally responsible for overseeing the institution's risk management, including Interest Rate Risk.

When a CFO presents a 40-page Excel printout with color-coded cells and footnotes referencing a model built by a consultant two years ago, boards cannot engage meaningfully with the risk content. They sign off because they trust the management team, not because they understand the analysis.

This is not an acceptable standard for governing institutions with $50M, $500M, or $2B in member assets.

CERNIQ's 14-page board report is designed for board members, not model risk specialists. The Executive Summary tells the board, in plain language in their preferred language, whether the institution is within regulatory thresholds on the metrics that matter. The charts are self-explanatory. The action items are specific and actionable. The narrative — in Spanish or English — connects the numbers to the institution's strategic context.

When a board member asks "what does a 300 basis point rate increase do to our equity?" a CERNIQ board report answers that question in the first two pages. The board can engage. The governance is real.

### This Is Financial Infrastructure, Not a Startup Product

CERNIQ is not a dashboarding tool. It is not a fintech experiment. It is not a visualization layer on top of somebody else's calculation engine.

CERNIQ is financial infrastructure. The 62 ALM modules are implementations of the same mathematical frameworks used by Goldman Sachs (Black-Litterman), Moody's Analytics (KMV-Merton), the Basel Committee (FRTB-IMA, CECL-aligned credit risk), and the Federal Reserve (Monte Carlo stress testing). They are not approximations of these frameworks — they are implementations of the same underlying mathematics, calibrated for community financial institution balance sheet characteristics and regulatory requirements.

The engineering stack — NestJS 11, PostgreSQL 15, Decimal arithmetic, AES-256-GCM encryption, cryptographic audit trail — is the same stack used by enterprise financial platforms. The difference is that CERNIQ delivers it in a SaaS model accessible to a $50M cooperative with a two-person finance team.

The bilingual capability is not a feature flag. It is a native architectural property. Every label, every report section, every error message exists in both English and Spanish. This reflects a fundamental belief: the 500,000 cooperative members in Puerto Rico, the millions served by Latin American cooperativas, the Spanish-speaking members of credit unions across the United States — they deserve the same quality of financial risk management infrastructure as the members of the largest institutions in the world. Language should not be a barrier to institutional-grade ALM.

### The Status Quo Has an Expiry Date

The 2022–2024 rate environment was the warning shot. The institutions that were caught unprepared — those that did not have the analytical visibility to see the NII erosion coming, that did not have the EVE models to understand their equity exposure, that did not have the Deposit Beta calibration to forecast the funding cost acceleration — those institutions paid for their tools deficit with their earnings, their capital ratios, and their examination standings.

The next rate shock will come. The next liquidity stress event will come. The next regulatory cycle tightening will come. When it does, the question every CFO and CRO at every community financial institution in the world should be able to answer is: "We saw it coming. Here is our model, here are our scenarios, here is our board documentation."

CERNIQ makes that answer possible for any financial institution with a balance sheet and a browser.

Upload your CSV. Get your report. Know your risk.

This is what institutional-grade ALM looks like when it is built for the institutions that need it most.

---

*CERNIQ is a product of KLYTICS LLC. This document is for informational purposes only. CERNIQ is an analytical reporting tool and does not constitute financial advice, legal counsel, or regulatory certification. All regulatory decisions remain the sole responsibility of the financial institution and its qualified personnel.*

*For platform access, pricing, and integration inquiries: [cerniq.com](https://cerniq.com)*

*Effective Date: 2026-04-16 | Version 1.0*

---

**END OF CERNIQ GLOBAL FINANCE ENGINEERING BIBLE**
