# Part VI — AI & Intelligence Engineering

> **Audience:** AI/ML Engineers, Quantitative Analysts, Backend Engineers
> **Last updated:** April 2026

---

## 6.1 CERNIQ's AI Architecture

CERNIQ has two distinct AI layers:

1. **Quantitative ALM Engine** — Deterministic mathematical models (62 modules). No LLM involved. Results are reproducible, auditable, and regulatorily defensible.
2. **LLM Intelligence Layer** — GPT-4o for narrative generation, insight commentary, and conversational Q&A. Sits on top of the quantitative engine — never computes metrics, only interprets them.

---

## 6.2 ALM Quantitative Engine — 62 Modules

All calculations run in the NestJS backend (`src/alm/`). Results stored as JSON in `AnalysisRun.result`.

### Interest Rate Risk Modules

| Module | Methodology | Key Output | COSSEC Threshold |
|--------|-------------|-----------|-----------------|
| **Duration Gap** | Modified duration of assets minus liabilities | Gap in years (positive = asset-sensitive, negative = liability-sensitive) | Gap > ±3 years → exam scrutiny |
| **NII Sensitivity** | Parallel rate shock scenarios (±100, ±200, ±300 bps) | Net Interest Income change ($ and %) per scenario | ΔNii/NII > 20% for 200bps shock |
| **EVE (Economic Value of Equity)** | PV(assets) - PV(liabilities) under rate scenarios | EVE ratio and EVE change per scenario | ΔEVE/EVE > 20% for 200bps shock |
| **BPV (Basis Point Value)** | Price change per 1bp rate movement | $ sensitivity per bucket and total | — |
| **Key Rate Durations** | Partial durations at key maturities (1Y, 2Y, 5Y, 10Y, 30Y) | Duration contribution per key rate | — |
| **Rate Shock v2** | Non-parallel rate shocks (steepener, flattener, twist) | Full repricing under custom scenarios | — |
| **Repricing Gap** | Assets vs liabilities repricing within time buckets | Static gap and cumulative gap per bucket | — |

### Stress Testing Modules

| Module | Methodology | Key Output |
|--------|-------------|-----------|
| **Monte Carlo** | Vasicek one-factor short-rate model; 10,000 paths; mean-reverting | Distribution of NII/EVE outcomes; 95th/99th percentile stress scenarios |
| **Scenario Builder** | User-defined multi-factor scenarios | Custom scenario impact on ALM position |
| **Scenario Compare** | Side-by-side comparison of multiple scenarios | Delta analysis between scenarios |
| **Stress Pack** | Pre-built regulatory stress packages (2008, COVID, PR debt crisis) | Institution performance under historical stress |
| **FRTB-IMA** | Internal Models Approach under Basel IV / FRTB | Expected Shortfall at 97.5% confidence |

**Vasicek Model specification:**
```
dr = κ(θ - r)dt + σdW
where:
  κ = mean reversion speed (calibrated quarterly)
  θ = long-run mean rate
  σ = rate volatility
  dW = Wiener process increment
Discretization: Euler-Maruyama (Δt = 1/52 weeks)
```

### Credit Risk Modules

| Module | Methodology | Key Output |
|--------|-------------|-----------|
| **CECL Vintage** | Vintage analysis with PD/LGD curves; FASB ASC 326 | Expected credit loss by vintage cohort |
| **KMV-Merton** | Structural default model (Merton 1974) | Distance to default, 1-year default probability |
| **Copula Credit** | Gaussian copula for credit correlation | Portfolio loss distribution, credit VaR |
| **Credit Metrics** | JP Morgan Credit Metrics framework | Rating transition matrix, credit loss |
| **Concentration** | Herfindahl-Hirschman Index (HHI) for sector/borrower | Concentration risk score |
| **Wrong-Way Risk** | Correlation between counterparty default and exposure | Adjusted CVA/exposure |

### Liquidity Modules

| Module | Methodology | Key Output |
|--------|-------------|-----------|
| **LCR** | Basel III; HQLA / Net Cash Outflows over 30 days | LCR % (minimum 100% per COSSEC) |
| **NSFR** | Net Stable Funding Ratio; ASF / RSF | NSFR % (minimum 100%) |
| **Cash Flow Bucketing** | Contractual + behavioral cash flows in time buckets | Net cash flow position per bucket |
| **SOFR Exposure** | SOFR transition impact on floating rate assets/liabilities | SOFR-linked balance and sensitivity |
| **Deposit Beta** | Regression of deposit rate vs market rate | Beta coefficient; repricing lag estimate |

### Portfolio Optimization Modules

| Module | Methodology | Key Output |
|--------|-------------|-----------|
| **Black-Litterman** | Equilibrium returns + investor views; Idzorek weighting | Optimal portfolio weights with view incorporation |
| **HRP (Hierarchical Risk Parity)** | Hierarchical clustering (Ward linkage); inverse-variance allocation | Portfolio weights without covariance matrix inversion |
| **Capital Optimizer** | Regulatory capital-constrained portfolio optimization | Max return allocation within capital constraints |
| **CVaR Optimizer** | Linear programming CVaR minimization (Rockafellar-Uryasev) | Min CVaR portfolio at target return |
| **VaR** | Historical, parametric, and Monte Carlo VaR | 1-day / 10-day VaR at 95%, 99% confidence |

### Regulatory Modules

| Module | Coverage | Output |
|--------|----------|--------|
| **COSSEC Compliance** | COSSEC regulatory thresholds; current exam prep checklist | Compliance score (0–100), findings list, remediation recommendations |
| **NCUA Form 5300** | NCUA quarterly call report; all schedules | Pre-populated Form 5300 data package |
| **Exam Prep** | Historical COSSEC exam question patterns | Exam readiness assessment |
| **Board Report** | 14-page bilingual board-ready PDF | PDF via PDFKit (ES/EN) |
| **CAMEL Forecast** | Predictive CAMEL rating based on current financials | CAMEL score with component breakdown |

### Advanced Modules

| Module | Methodology | Key Output |
|--------|-------------|-----------|
| **PCA Yield Curve** | Nelson-Siegel decomposition; PCA on rate movements | Level, slope, curvature factors; explained variance |
| **Macro Regime Detection** | Hidden Markov Model (2-state: expansion/contraction) | Current regime probability; regime history |
| **NIM Attribution** | Decompose NIM change into volume, rate, mix effects | NIM attribution waterfall |
| **FTP Attribution** | Transfer pricing waterfall for funding cost allocation | FTP rate by instrument; net contribution margin |
| **Climate Risk** | NGFS scenarios (Net Zero 2050, Delayed Transition, Hot House World) | Climate-adjusted credit risk; stranded asset exposure |

---

## 6.3 OpenAI Integration

### LLM Usage Points

| Feature | Prompt Strategy | Model | Context Size |
|---------|----------------|-------|-------------|
| Board Report Executive Summary | Structured prompt with all KPI values; instruction to write in regulatory language | GPT-4o | 4,000 tokens |
| COSSEC Risk Commentary | Threshold-aware prompt with findings list; bilingual instruction | GPT-4o | 2,000 tokens |
| AI Advisor Chat | System prompt defining cooperativa ALM expert persona; user question + current KPIs as context | GPT-4o | 8,000 tokens |
| Scenario Interpretation | Stress test results + regulatory context → narrative | GPT-4o | 3,000 tokens |
| Spanish Fine-tuning | Domain-specific cooperativa vocabulary + COSSEC regulatory language | GPT-4o fine-tuned | — |

### Ollama Fallback
```typescript
// src/llm/llm.service.ts
async generate(prompt: string): Promise<string> {
  try {
    return await this.openai.chat(prompt)    // Primary
  } catch (openAIError) {
    return await this.ollama.generate(prompt) // Fallback
  }
}
```

Ollama serves a locally-hosted model (Llama 3.1 8B) for offline/development use. Quality is lower than GPT-4o but maintains zero-downtime operation when OpenAI API is unavailable.

---

## 6.4 Model Registry (`src/model-registry/`)

Version-controlled registry of ALM quantitative models. Each model version is tagged with:
- `modelId` — unique identifier (e.g., `vasicek-v2`, `cecl-vintage-v1`)
- `version` — semantic version
- `parameters` — calibrated parameters (JSON)
- `calibrationDate` — date of last parameter calibration
- `validatedBy` — analyst who signed off on calibration
- `changelog` — what changed from previous version

Model parameters are not hard-coded — they are loaded from the registry at runtime, enabling quarterly recalibration without code deploys.

---

## 6.5 Outbound Sales Intelligence Engine

Separate Python 3 / FastAPI microservice at `services/outbound/`. Runs 6 autonomous agents in a YAML-orchestrated pipeline:

```
services/outbound/
├── agents/
│   ├── lead_research.py     # Identifies cooperativas from COSSEC public registry
│   ├── enrichment.py        # Augments leads: contact info, LinkedIn, financial data
│   ├── messaging.py         # Generates personalized bilingual email sequences
│   ├── outreach.py          # Sends cold emails via Resend API
│   ├── crm.py               # Updates CERNIQ leads table (Prisma → NestJS API)
│   └── followup.py          # Schedules follow-up sequences based on engagement
├── pipelines/
│   ├── lead_ingestion.yaml  # Daily: discover → enrich → stage
│   └── daily_outreach.yaml  # Daily: select → personalize → send → CRM update
└── templates/
    ├── initial_es.txt        # Spanish initial outreach (primary)
    ├── initial_en.txt        # English initial outreach
    ├── followup_1_es.txt     # Day 3 follow-up (ES)
    └── followup_2_es.txt     # Day 7 follow-up (ES)
```

### Agent Pipeline Flow
```
Daily cron (9 AM PR time)
  │
  ▼
Lead Research Agent
  → Scrapes COSSEC public registry
  → Identifies cooperativas not yet in CERNIQ leads DB
  │
  ▼
Enrichment Agent
  → LinkedIn Sales Navigator API (or web scraping fallback)
  → Puerto Rico financial institution data (FDIC, COSSEC public data)
  → Contact discovery: CFO, Finance Director, Board President
  │
  ▼
Messaging Agent (GPT-4o powered)
  → Generates personalized email: references institution name, asset size, regulatory context
  → Primary in Spanish; English variant if contact name suggests US-educated
  │
  ▼
Outreach Agent
  → Resend API: sends initial email
  → Records send_timestamp, message_id in leads DB
  │
  ▼
CRM Agent
  → POST /api/leads (with ADMIN_API_KEY)
  → Updates pipeline stage: IDENTIFIED → CONTACTED
  │
  ▼
Follow-up Agent (daily check)
  → If opened but no reply after 3 days → send followup_1
  → If no open after 5 days → send followup_2 (different hook)
  → If replied → flag for human follow-up → exit automated sequence
```

---

## 6.6 Apple Platform AI Roadmap

### Phase 1 — Q2 2026: On-Device Risk Classification (CoreML)
- Train lightweight binary classifier: `{durationGap, lcr, nim}` → `MetricStatus`
- Replace `LiveWorkspaceOverviewService.buildHighlights()` server-computed logic with CoreML inference
- Zero network latency for KPI color coding — computed locally from cached data
- Model size target: < 500KB (fits in app bundle)

### Phase 2 — Q3 2026: Siri Shortcuts (App Intents Framework)
```swift
struct GetLCRRatioIntent: AppIntent {
    static var title: LocalizedStringResource = "Get LCR Ratio"
    static var description = IntentDescription("Get the current Liquidity Coverage Ratio for your institution")
    
    @Parameter(title: "Institution")
    var institution: InstitutionEntity
    
    func perform() async throws -> some ReturnsValue<Double> {
        let summary = try await ALMService.summary(for: institution.id)
        return .result(value: summary.liquidityCoverageRatio ?? 0)
    }
}
```

Actionable via Siri: "Hey Siri, get my cooperativa's LCR ratio"
Available as Shortcuts automation trigger.

### Phase 3 — Q4 2026: Apple Intelligence Integration
- Writing Tools API: intelligent summarization of ALM report PDFs
- System prompt: CERNIQ regulatory expert persona
- User triggers via share sheet → Writing Tools → "Summarize for Board"
- Output: 3-sentence executive summary in user's preferred language

### Phase 4 — 2027: On-Device Fine-Tuned Model
- Fine-tune a compact Spanish-language model on COSSEC regulatory corpus
- Serve via CoreML for zero-latency, zero-cost COSSEC commentary
- No data leaves device — critical for financial privacy compliance
- Target: 7B parameter quantized model (Q4, <4GB memory footprint)

---

## 6.7 Fine-Tuning Pipeline (`src/fine-tune/`)

```
Training data collection
  → Curate cooperativa regulatory documents (COSSEC bulletins, NCUA guidance)
  → Collect board report examples (anonymized)
  → Format as prompt/completion pairs in JSONL

Fine-tuning job
  → OpenAI fine-tuning API: gpt-4o-mini base
  → Hyperparams: n_epochs=3, learning_rate_multiplier=0.1
  → Training loss monitored via OpenAI dashboard

Evaluation
  → Test on held-out cooperativa scenarios
  → Human review by Puerto Rico financial analyst
  → A/B test vs base GPT-4o on 50 random regulatory commentary prompts

Deployment
  → model-registry: tag as fine-tuned-cossec-v1
  → Feature flag rollout: 10% → 50% → 100%
```

---

*KLYTICS LLC · Proprietary & Confidential · cerniq.io*
