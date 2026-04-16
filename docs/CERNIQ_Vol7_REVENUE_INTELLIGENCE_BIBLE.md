# CERNIQ Vol. 7: Revenue Intelligence Bible
## Asset-Liability Management Platform — Puerto Rico Cooperativas & Credit Unions
### Confidential Internal Strategy Document | April 2026 | v1.0

---

> **Mission:** $1,000,000 ARR by September 30, 2027. This document is the complete operating system for how CERNIQ makes, tracks, defends, and grows every dollar of revenue.

---

## TABLE OF CONTENTS

1. [Revenue Architecture](#1-revenue-architecture)
2. [The $1M ARR Roadmap](#2-the-1m-arr-roadmap)
3. [Lead Pipeline Intelligence](#3-lead-pipeline-intelligence)
4. [Stripe Operations Playbook](#4-stripe-operations-playbook)
5. [Demo → Revenue Intelligence](#5-demo--revenue-intelligence)
6. [CPA Partner Revenue Engine](#6-cpa-partner-revenue-engine)
7. [Churn Prevention Protocol](#7-churn-prevention-protocol)
8. [Revenue Ops CLI Agents](#8-revenue-ops-cli-agents)
9. [Board-Level Revenue Metrics](#9-board-level-revenue-metrics)
10. [Revenue Operations Calendar](#10-revenue-operations-calendar)

---

---

# 1. REVENUE ARCHITECTURE

## 1.1 The Four Revenue Streams

CERNIQ operates four distinct revenue streams, each with different economics, velocity, and strategic purpose. Understanding which stream to push at each stage of growth is as important as the product itself.

| Stream | Type | Buyer | Price Point | Strategic Role |
|---|---|---|---|---|
| One-Time Reports | Transactional | CFO / Auditor | $299–$499 | Acquisition wedge, proof of value |
| Professional Subscription | Recurring | Cooperativa | $299/mo or $2,990/yr | Core MRR engine |
| Enterprise Subscription | Recurring | Multi-institution | $799/mo or $7,990/yr | ACV expansion, net dollar retention |
| Partner (CPA) Tier | Recurring + Rev Share | CPA firm | $199–$499/mo + 20% rev share | Channel leverage, CAC reduction |

### Stream 1: One-Time Reports

The entry-level product. A cooperativa uploads their balance sheet CSV, CERNIQ's ALM engine processes it, and a 14-page board-ready PDF is generated in under 10 minutes. This is the displacement of a $15,000 consultant engagement delivered at $299.

**Pricing:**
- Single ALM Report: **$299**
- COSSEC Compliance Bundle (ALM + Liquidity Stress + Rate Sensitivity): **$499**
- Annual Audit Package (4 quarterly reports): **$999** (saves $197 vs. quarterly single)

**Use cases:** One-time audit prep, COSSEC examination readiness, board presentation prep, first-time CERNIQ users evaluating before subscribing.

**Economics:** Zero marginal cost per additional report beyond infrastructure (OpenAI token costs, ~$0.40–$0.80 per report at current model pricing). Gross margin on reports: **~97%**.

### Stream 2: Professional Subscription

The core MRR driver. Month-over-month recurring revenue from individual cooperativas with ongoing ALM monitoring needs.

**Pricing:**
- Monthly: **$299/month**
- Annual: **$2,990/year** (2 months free — $598 discount)
- Upgrade incentive: Any existing report customer gets 30% off first year Professional

**Included in Professional:**
- Unlimited ALM reports per month
- Real-time rate sensitivity dashboard
- COSSEC benchmark comparison (109-cooperativa sector data)
- Bilingual board packet export (PDF + Excel)
- Email alerts for rate threshold breaches
- Up to 3 user seats

**Economics at Professional tier:**
- Monthly ARPU: $299
- Annual ARPU (annual plan): $249/mo effective
- Churn target: <2% monthly (= 26% annual retention for SaaS benchmark)
- LTV at 2% churn: $14,950 per account (monthly plan)

### Stream 3: Enterprise Subscription

Designed for multi-branch cooperativas, credit union holding structures, or any institution managing more than one charter.

**Pricing:**
- Monthly: **$799/month**
- Annual: **$7,990/year** (2 months free)
- Custom enterprise contracts for 5+ institutions: negotiated, typically $3,000–$5,000/month

**Included in Enterprise (all Professional features plus):**
- Up to 10 institutions on one dashboard
- Consolidated multi-entity ALM view
- Custom benchmark peer groups
- API access (rate limit: 1,000 calls/day)
- Dedicated Slack channel or email support
- Quarterly strategic review call

**Economics at Enterprise tier:**
- Monthly ARPU: $799
- LTV at 1.5% churn: $53,267 per account

### Stream 4: Partner (CPA) Tier

The channel multiplier. A single CPA firm with 10–15 cooperativa clients becomes a $20,000–$50,000 ARR account. The partner tier is how CERNIQ achieves force multiplication without a 50-person sales team.

**Pricing:**
- CPA Silver (up to 5 cooperativa clients): **$199/month** + 20% rev share on client subscriptions
- CPA Gold (up to 15 cooperativa clients): **$399/month** + 20% rev share
- CPA Platinum (unlimited clients, white-label): **$499/month** + 15% rev share

**White-label billing model:**
- CPA charges their cooperativa client directly (e.g., $499/month as part of their retainer)
- CERNIQ bills CPA at the published rate minus rev share
- CPA captures ~$150–$300/month per client relationship on top of existing retainer fees
- CPA's cost is $199–$499/month fixed — economics become extremely favorable at 4+ clients

---

## 1.2 Pricing Tier Detail

```
┌────────────────────────────────────────────────────────────────────────┐
│                     CERNIQ PRICING MATRIX — APRIL 2026                 │
├──────────────────┬──────────────┬──────────────┬────────────────────────┤
│ Tier             │ Monthly      │ Annual       │ Best For               │
├──────────────────┼──────────────┼──────────────┼────────────────────────┤
│ Report (1x)      │ $299 (once)  │ $999 (4x)    │ First-time, audit prep │
│ Professional     │ $299/mo      │ $2,990/yr    │ Single cooperativa     │
│ Enterprise       │ $799/mo      │ $7,990/yr    │ Multi-institution      │
│ CPA Silver       │ $199/mo      │ —            │ CPA, 1–5 clients       │
│ CPA Gold         │ $399/mo      │ —            │ CPA, 6–15 clients      │
│ CPA Platinum     │ $499/mo      │ —            │ CPA, 16+ / white-label │
└──────────────────┴──────────────┴──────────────┴────────────────────────┘
```

---

## 1.3 Unit Economics

### Customer Acquisition Cost (CAC) Targets

| Channel | Target CAC | Justification |
|---|---|---|
| Outbound (direct cooperativa) | $500–$1,200 | Founder-led, time cost only in early stage |
| CPA Channel (indirect) | $200–$400 | CPA does the selling; CERNIQ incurs onboarding cost |
| Inbound (demo → paid) | $50–$150 | Near-zero marginal cost for self-serve demo conversion |
| Paid ads (future, Q4 2026) | $800–$2,000 | Not yet active; budget TBD based on blended CAC |

### Lifetime Value (LTV) Targets

| Tier | Monthly ARPU | Avg. Churn | LTV |
|---|---|---|---|
| Report (one-time) | $299 single | N/A | $299 + 60% upsell to Pro ($2,990) |
| Professional | $299 | 2.0%/mo | **$14,950** |
| Enterprise | $799 | 1.5%/mo | **$53,267** |
| CPA Partner (Gold avg.) | $399 + ~$300 rev share | 1.0%/mo | **$69,900** |

### LTV:CAC Targets

- Professional: 14,950 / 1,200 = **12.5x** (target >10x for healthy SaaS)
- Enterprise: 53,267 / 2,000 = **26.6x** (exceptional)
- CPA Gold: 69,900 / 400 = **174x** (channel economics are extraordinary)

### Payback Period

| Tier | CAC | Monthly Gross Profit | Payback Period |
|---|---|---|---|
| Professional | $1,200 | $290 (97% margin) | ~4.1 months |
| Enterprise | $2,000 | $775 | ~2.6 months |
| CPA Gold | $400 | $675 (partner + rev share) | <1 month |

---

## 1.4 Gross Margin Analysis

CERNIQ's COGS are almost entirely infrastructure. The platform is asset-light by design.

### Monthly COGS at 50 Active Professional Accounts

| Cost Item | Monthly Estimate | Notes |
|---|---|---|
| Railway hosting (backend) | $45 | Scales with requests; generous free tier used early |
| Vercel (frontend/edge) | $20 | Pro plan |
| Resend (email) | $20 | 50K emails/month plan |
| OpenAI API (report gen) | $120 | ~$0.80/report × 150 reports generated |
| Stripe fees | $435 | 2.9% + $0.30 on ~$14,950 MRR |
| PostgreSQL (Neon/Supabase) | $25 | Pro plan |
| Domain / misc. | $15 | |
| **Total COGS** | **$680** | |

**Gross Margin at $14,950 MRR (50 accounts):** ($14,950 - $680) / $14,950 = **95.5%**

### Gross Margin at $83,333 MRR ($1M ARR)

| Cost Item | Monthly Estimate |
|---|---|
| Railway (scaled) | $180 |
| Vercel | $40 |
| Resend | $45 |
| OpenAI API (1,200 reports/mo) | $960 |
| Stripe fees | $2,417 |
| PostgreSQL | $85 |
| Support tooling (Intercom/Crisp) | $150 |
| Misc. | $50 |
| **Total COGS** | **$3,927** |

**Gross Margin at $1M ARR:** ($83,333 - $3,927) / $83,333 = **95.3%**

This is a hallmark SaaS gross margin profile. Comparable to best-in-class fintech infrastructure businesses (Stripe ~69%, Brex ~60%, but vertical SaaS with AI-generated content regularly hits 85–95%).

---

---

# 2. THE $1M ARR ROADMAP

## 2.1 The North Star Math

**$1,000,000 ARR = $83,333 MRR**

Achievable combinations to reach $83,333 MRR:

| Mix | Accounts Needed |
|---|---|
| 100% Professional ($299/mo) | 279 accounts — impossible (only 109 cooperativas exist) |
| 100% Enterprise ($799/mo) | 104 accounts — theoretically possible but unrealistic for v1 |
| **Realistic Mix (target)** | **~55 Pro + ~25 Enterprise + ~8 CPA Gold** |
| Blended ARPU target | $473/account |
| Accounts needed at $473 ARPU | **176 paying accounts** |

The 109 cooperativa TAM plus 40+ credit unions plus 15–20 CPA firms gives an addressable pool of ~165 potential accounts before considering multi-seat Enterprise accounts that count once but pay at $799. The math works if penetration reaches 60–70% of total addressable market — achievable given the displacement economics.

---

## 2.2 Month-by-Month Revenue Model (April 2026 → September 2027)

### Phase 1: Foundation (Apr–Jun 2026)
**Theme: First Revenue, Pipeline Proof**

| Month | New Accts | Churned | Total Accts | MRR | ARR Run Rate |
|---|---|---|---|---|---|
| Apr 2026 | 3 | 0 | 3 | $897 | $10,764 |
| May 2026 | 5 | 0 | 8 | $2,392 | $28,704 |
| Jun 2026 | 7 | 1 | 14 | $4,186 | $50,232 |

**Phase 1 account mix target:**
- 12 Professional accounts ($3,588/mo)
- 1 Enterprise account ($799/mo)
- 1 CPA Silver account ($199/mo)

**Critical path in Phase 1:**
1. Close first 3 paying accounts — any tier, any price
2. Deliver exceptional first-report experience (NPS >50 from first cohort)
3. Activate CPA outreach — 5 firms minimum by end of May
4. Establish weekly revenue review cadence with Erwin

---

### Phase 2: Channel Proof (Jul–Sep 2026)
**Theme: CPA Channel Activation, First Enterprise**

| Month | New Accts | Churned | Total Accts | MRR | ARR Run Rate |
|---|---|---|---|---|---|
| Jul 2026 | 8 | 1 | 21 | $6,279 | $75,348 |
| Aug 2026 | 10 | 2 | 29 | $8,671 | $104,052 |
| Sep 2026 | 12 | 2 | 39 | $11,661 | $139,932 |

**Phase 2 account mix target (end of Sep 2026):**
- 28 Professional accounts ($8,372/mo)
- 4 Enterprise accounts ($3,196/mo)
- 3 CPA Gold accounts ($1,197/mo + ~$800 rev share)
- MRR: ~$13,565 (slightly ahead of $11,661 base case — aim for this)

**Critical path in Phase 2:**
1. Sign first CPA Gold partner — becomes anchor case study
2. Close first Enterprise account (multi-branch cooperativa or NCUA credit union)
3. Annual plan conversion push: target 40% of Pro accounts on annual
4. Build first referral event: cooperativa CFO refers peer

---

### Phase 3: Acceleration (Oct 2026–Jan 2027)
**Theme: Referral Loop, Annual Push, $25K MRR Milestone**

| Month | New Accts | Churned | Total Accts | MRR | ARR Run Rate |
|---|---|---|---|---|---|
| Oct 2026 | 14 | 3 | 50 | $14,950 | $179,400 |
| Nov 2026 | 16 | 3 | 63 | $18,837 | $226,044 |
| Dec 2026 | 14 | 4 | 73 | $21,827 | $261,924 |
| Jan 2027 | 18 | 4 | 87 | $25,013 | $300,156 |

**$25K MRR Milestone Composition (Jan 2027 target):**
- 52 Professional accounts ($15,548/mo)
- 14 Enterprise accounts ($11,186/mo)
- 6 CPA Gold + 2 CPA Platinum accounts ($3,390 fixed + ~$1,500 rev share = $4,890/mo)
- **Total: ~$31,624 MRR** (accounts for rev share pass-through; conservative model shows $25K)

---

### Phase 4: Scale (Feb–Jun 2027)
**Theme: $50K MRR, Hire First AE, Pricing Power Test**

| Month | New Accts | Churned | Total Accts | MRR | ARR Run Rate |
|---|---|---|---|---|---|
| Feb 2027 | 20 | 5 | 102 | $30,298 | $363,576 |
| Mar 2027 | 22 | 5 | 119 | $35,581 | $426,972 |
| Apr 2027 | 18 | 6 | 131 | $39,169 | $470,028 |
| May 2027 | 22 | 6 | 147 | $43,953 | $527,436 |
| Jun 2027 | 22 | 7 | 162 | $48,438 | $581,256 |

**Decision gate at $30K MRR (Feb 2027):**
- If NRR >110%: expand into NCUA credit unions outside PR
- If CPA channel contributes >30% of MRR: double down with Gold→Platinum upgrade push
- If demo→paid conversion >15%: increase paid acquisition spend to $5K/month

---

### Phase 5: Finish Line (Jul–Sep 2027)
**Theme: $83K MRR, $1M ARR**

| Month | New Accts | Churned | Total Accts | MRR | ARR Run Rate |
|---|---|---|---|---|---|
| Jul 2027 | 24 | 8 | 178 | $54,222 | $650,664 |
| Aug 2027 | 26 | 8 | 196 | $59,804 | $717,648 |
| **Sep 2027** | **26** | **9** | **213** | **$83,333** | **$1,000,000** |

**$1M ARR Account Mix (Sep 2027 target):**

| Tier | Accounts | MRR |
|---|---|---|
| Professional (monthly) | 65 | $19,435 |
| Professional (annual, effective monthly) | 45 | $11,205 |
| Enterprise (monthly) | 32 | $25,568 |
| Enterprise (annual, effective monthly) | 18 | $11,970 |
| CPA Gold | 12 | $4,788 |
| CPA Platinum | 8 | $3,992 |
| Rev share (CPA clients, avg $250/partner) | — | $5,000 |
| Report (one-time, normalized monthly) | — | $1,375 |
| **TOTAL** | **180 accounts** | **$83,333** |

---

## 2.3 Risk Scenarios

| Scenario | Key Assumption | Sep 2027 MRR | ARR |
|---|---|---|---|
| **Optimistic** | CPA channel scales fast (3+ Platinum by Q1 2027), 50% annual conversion | $105,000 | $1.26M |
| **Base** | Steady direct outbound + 1 CPA partner/month from Aug 2026 | $83,333 | $1.00M |
| **Conservative** | Slow CPA adoption, high early churn (3.5%/mo), no Enterprise until Q2 2027 | $52,000 | $624K |

**Conservative scenario recovery path:** If base case is tracking below by Dec 2026, trigger: (a) reduce Professional price to $249/mo to accelerate volume, (b) aggressive annual plan push with 3-months-free incentive, (c) emergency CPA blitz (board intro calls through Erwin's network).

---

## 2.4 Decision Gates

| Trigger | Decision |
|---|---|
| MRR hits $5K | Increase outbound from 6 agents to 9; add NCUA CU outreach sequence |
| MRR hits $15K | Hire first part-time Customer Success contractor; initiate CPA webinar series |
| MRR hits $30K | Price increase test: Professional → $349/mo for new customers; existing grandfathered |
| MRR hits $50K | Hire first AE (quota: $15K MRR/quarter); expand to mainland PR diaspora credit unions |
| NRR exceeds 120% for 2 consecutive months | Raise Enterprise to $999/mo; introduce $1,499 Enterprise+ tier |
| CPA channel > 35% of MRR | Dedicated Partner Manager hire; build CPA portal (self-serve onboarding) |

---

---

# 3. LEAD PIPELINE INTELLIGENCE

## 3.1 The 9 Pipeline Statuses

Each status has defined entry criteria, required actions, and exit criteria. No lead advances without satisfying the exit criteria of the current status.

### Status 1: `new`
**Definition:** Lead has been created in the system but no outreach has been initiated.

- **Entry criteria:** ProspectInstitution record exists in DB; lead enriched with contact info, asset size, COSSEC status
- **Required action within 24 hours:** Assign priority (HIGH/MEDIUM/LOW); queue for initial outreach sequence
- **Exit criteria:** First outreach email sent → moves to `contacted`
- **SLA:** 24 hours maximum in this status

### Status 2: `contacted`
**Definition:** Initial outreach has been sent. Awaiting response.

- **Entry criteria:** At least one outbound touchpoint delivered (email, LinkedIn, phone)
- **Required action:** Log touchpoint; set follow-up date (T+4 days)
- **Exit criteria:** No response after 3 touchpoints → `nurture`; any positive response → `engaged`; bounce/unsubscribe → `disqualified`
- **SLA:** 10 business days (3 touchpoints at T+0, T+4, T+8)

### Status 3: `engaged`
**Definition:** Lead has responded or demonstrated intent (opened email 3+ times, clicked demo link, visited /pricing).

- **Entry criteria:** Any reply, click, or tracked engagement event above threshold
- **Required action:** Personalized follow-up within 4 hours of engagement signal; attempt to book demo
- **Exit criteria:** Demo scheduled → `demo_scheduled`; uninterested → `nurture`
- **SLA:** 4-hour response time on engagement signals

### Status 4: `demo_scheduled`
**Definition:** Demo appointment confirmed in calendar.

- **Entry criteria:** Calendar invite accepted; confirmation email sent
- **Required action:** Pre-demo prep email with cooperativa-specific benchmark data 24 hours before; assign demo-specific ROI estimate
- **Exit criteria:** Demo completed → `demo_completed`; no-show (2nd attempt) → `engaged`; cancelled with reschedule → back to `engaged`
- **SLA:** Demo should occur within 7 days of scheduling

### Status 5: `demo_completed`
**Definition:** Live or recorded demo has been delivered.

- **Entry criteria:** Demo session ID logged; at least PDF_DOWNLOADED event fired
- **Required action:** 24-hour follow-up with personalized report PDF; send /roi calculator link; identify decision-maker and champion
- **Exit criteria:** Trial started or paid → `trial` or `customer`; explicit no → `lost`; no response after 5 days → `nurture`
- **SLA:** Follow-up within 24 hours of demo completion

### Status 6: `trial`
**Definition:** Lead has activated a free trial or report-generation access.

- **Entry criteria:** Trial account created; report generated (any type)
- **Required action:** Day 1 onboarding check-in; Day 3 usage review; Day 7 conversion call
- **Exit criteria:** Stripe payment captured → `customer`; trial expires without conversion → `nurture`; explicit opt-out → `lost`
- **SLA:** 14-day trial window; conversion call at Day 7

### Status 7: `customer`
**Definition:** Active paying Stripe subscription or completed one-time report purchase.

- **Entry criteria:** Stripe `checkout.session.completed` or `invoice.payment_succeeded` webhook received and logged
- **Required action:** Onboarding sequence triggered; health score initialized; CSM assigned at Enterprise tier
- **Exit criteria:** Subscription cancelled → `churned`; downgrade → remains `customer` with tier updated
- **SLA:** Welcome email within 5 minutes of payment (Resend webhook trigger)

### Status 8: `nurture`
**Definition:** Lead is not ready to buy but has not been disqualified. Placed in long-cycle educational sequence.

- **Entry criteria:** Fell through from `contacted`, `engaged`, or `demo_completed` without conversion
- **Required action:** Add to monthly newsletter; COSSEC regulatory update emails; quarterly ALM benchmark report email
- **Exit criteria:** Re-engages (clicks, replies) → move back to `engaged`; annual review at 6 months — if still no engagement → `disqualified`
- **SLA:** Monthly minimum touchpoint; no aggressive selling

### Status 9: `disqualified`
**Definition:** Lead confirmed not a fit or explicitly opted out.

- **Entry criteria:** Hard bounce, explicit opt-out, confirmed closure, institution dissolved, or outside PR/NCUA jurisdiction
- **Required action:** Record disqualification reason; flag in ProspectInstitution; remove from all sequences
- **Exit criteria:** Permanent (review annually for market condition changes)
- **SLA:** Processed within 24 hours of disqualification signal

---

## 3.2 Lead Scoring Algorithm

Each lead receives a composite score from 0–100. Scores above 70 auto-elevate to HIGH priority and trigger same-day outreach.

### Scoring Formula

```
LeadScore = (AssetScore × 0.25) + (COSSECScore × 0.30) + (EngagementScore × 0.25) + (CPAScore × 0.20)
```

#### AssetScore (0–25 points)
Derived from ProspectInstitution.total_assets_millions:

| Asset Range | Score |
|---|---|
| > $500M | 25 |
| $250M–$500M | 22 |
| $100M–$250M | 18 |
| $50M–$100M | 14 |
| $25M–$50M | 10 |
| < $25M | 6 |

#### COSSECScore (0–30 points)
Derived from CooperativaBenchmark.cossec_status and recent findings:

| COSSEC Signal | Score |
|---|---|
| Recent examination with findings (ALM/liquidity) | 30 |
| Examination pending in next 90 days | 25 |
| Clean exam but rate sensitivity >2% NII impact | 20 |
| No recent findings, stable | 10 |
| No COSSEC data available | 5 |

#### EngagementScore (0–25 points)
Derived from tracked demo events and email activity:

| Engagement Signal | Points |
|---|---|
| PDF_DOWNLOADED | +10 |
| ROI_CALCULATED | +8 |
| DEMO_COMPLETED (>8 minutes) | +7 |
| Email opened 3+ times | +5 |
| /pricing page visit | +5 |
| Demo started but abandoned | +2 |
| Maximum cap | 25 |

#### CPAScore (0–20 points)
Derived from known CPA relationships:

| CPA Signal | Score |
|---|---|
| Known CERNIQ CPA partner serves this cooperativa | 20 |
| CPA firm in outreach sequence | 12 |
| Public audit firm identified (COSSEC filing) | 8 |
| No CPA data | 0 |

---

## 3.3 Auto-Priority Logic

```sql
-- Auto-priority assignment rule (runs on INSERT and UPDATE of leads table)
UPDATE leads
SET priority = CASE
  WHEN institution_type = 'cooperativa' AND lead_score >= 70 THEN 'HIGH'
  WHEN institution_type = 'cooperativa' AND lead_score >= 45 THEN 'HIGH'  -- all cooperativas are at least HIGH
  WHEN institution_type = 'credit_union' AND lead_score >= 60 THEN 'HIGH'
  WHEN institution_type = 'credit_union' AND lead_score >= 30 THEN 'MEDIUM'
  WHEN institution_type = 'cpa_consultant' AND lead_score >= 50 THEN 'HIGH'
  WHEN institution_type = 'cpa_consultant' THEN 'MEDIUM'
  ELSE 'LOW'
END
WHERE id = NEW.id;
```

**Rule rationale:** Every cooperativa in the 109-institution market is HIGH priority by default because the TAM is finite and closed. There is no such thing as a LOW-priority cooperativa.

---

## 3.4 Conversion Funnel Benchmarks

| Stage Transition | Target Conversion Rate | Industry Benchmark | CERNIQ Advantage |
|---|---|---|---|
| `new` → `contacted` | 100% (SLA-enforced) | 100% | n/a |
| `contacted` → `engaged` | 25–35% | 15–20% | Hyper-personalized with cooperativa-specific COSSEC data |
| `engaged` → `demo_scheduled` | 40–55% | 30–40% | Clear ROI story ($15K displaced) |
| `demo_scheduled` → `demo_completed` | 75–85% | 60–70% | Demo is self-serve; easy to reschedule |
| `demo_completed` → `trial/customer` | 30–45% | 20–30% | Instant value delivery (report in <10 min) |
| `trial` → `customer` | 55–70% | 40–60% | Trial generates board-ready artifact; proof is tangible |
| **Overall: `new` → `customer`** | **4–8%** | **2–4%** | **2x industry due to vertical specificity** |

---

## 3.5 Pipeline Velocity Metrics

**Pipeline Velocity Formula:**
```
Pipeline Velocity = (Qualified Leads × Win Rate × Average Deal Value) / Sales Cycle Length (days)
```

**Target metrics by phase:**

| Phase | Qualified Leads | Win Rate | Avg Deal Value | Cycle Length | Daily Velocity |
|---|---|---|---|---|---|
| Phase 1 (Apr–Jun 26) | 25 | 6% | $2,388 | 45 days | $79.60/day |
| Phase 2 (Jul–Sep 26) | 60 | 8% | $3,200 | 38 days | $404.21/day |
| Phase 3 (Oct 26–Jan 27) | 120 | 10% | $3,800 | 30 days | $1,520/day |
| Phase 4 (Feb–Jun 27) | 200 | 12% | $4,200 | 25 days | $4,032/day |

---

## 3.6 SQL Queries for RevOps CLI Agents

```sql
-- 1. Full pipeline health snapshot
SELECT
  status,
  priority,
  COUNT(*) as count,
  SUM(pipeline_value_usd) as total_pipeline_value,
  AVG(lead_score) as avg_score,
  AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400) as avg_days_in_status
FROM leads
WHERE status NOT IN ('disqualified', 'customer')
GROUP BY status, priority
ORDER BY
  CASE status
    WHEN 'demo_scheduled' THEN 1
    WHEN 'demo_completed' THEN 2
    WHEN 'trial' THEN 3
    WHEN 'engaged' THEN 4
    WHEN 'contacted' THEN 5
    WHEN 'nurture' THEN 6
    WHEN 'new' THEN 7
  END, priority;

-- 2. Stale deals (no activity in > SLA window)
SELECT
  l.id,
  pi.institution_name,
  l.status,
  l.priority,
  l.lead_score,
  l.next_follow_up,
  EXTRACT(EPOCH FROM (NOW() - l.updated_at)) / 86400 as days_since_update
FROM leads l
JOIN prospect_institutions pi ON l.institution_id = pi.id
WHERE
  l.status IN ('contacted', 'engaged', 'demo_scheduled', 'demo_completed')
  AND l.updated_at < NOW() - INTERVAL '5 days'
  AND l.status != 'disqualified'
ORDER BY days_since_update DESC;

-- 3. MRR delta (last 30 days vs. prior 30 days)
WITH current_period AS (
  SELECT COALESCE(SUM(mrr_contribution_usd), 0) as mrr
  FROM leads
  WHERE status = 'customer'
    AND converted_at >= NOW() - INTERVAL '30 days'
),
prior_period AS (
  SELECT COALESCE(SUM(mrr_contribution_usd), 0) as mrr
  FROM leads
  WHERE status = 'customer'
    AND converted_at >= NOW() - INTERVAL '60 days'
    AND converted_at < NOW() - INTERVAL '30 days'
)
SELECT
  current_period.mrr as current_mrr,
  prior_period.mrr as prior_mrr,
  current_period.mrr - prior_period.mrr as mrr_delta,
  CASE WHEN prior_period.mrr > 0
    THEN ROUND(((current_period.mrr - prior_period.mrr) / prior_period.mrr * 100)::numeric, 2)
    ELSE NULL
  END as growth_pct
FROM current_period, prior_period;

-- 4. Conversion funnel rates (last 90 days)
WITH stage_counts AS (
  SELECT
    status,
    COUNT(*) as leads_in_stage
  FROM leads
  WHERE created_at >= NOW() - INTERVAL '90 days'
  GROUP BY status
)
SELECT
  status,
  leads_in_stage,
  ROUND(
    leads_in_stage::numeric / SUM(leads_in_stage) OVER () * 100, 2
  ) as pct_of_total
FROM stage_counts
ORDER BY leads_in_stage DESC;

-- 5. Lead score distribution for pipeline prioritization
SELECT
  CASE
    WHEN lead_score >= 70 THEN 'A (70–100)'
    WHEN lead_score >= 50 THEN 'B (50–69)'
    WHEN lead_score >= 30 THEN 'C (30–49)'
    ELSE 'D (0–29)'
  END as score_band,
  COUNT(*) as leads,
  SUM(pipeline_value_usd) as pipeline_value,
  AVG(lead_score) as avg_score
FROM leads
WHERE status NOT IN ('customer', 'disqualified', 'lost')
GROUP BY score_band
ORDER BY avg_score DESC;
```

---

---

# 4. STRIPE OPERATIONS PLAYBOOK

## 4.1 Subscription Tier Configuration

```javascript
// Stripe Price IDs — production configuration
const STRIPE_PRICES = {
  report_single: 'price_report_299',           // $299 one-time
  report_bundle_4: 'price_report_bundle_999',  // $999 one-time (4 reports)
  professional_monthly: 'price_pro_monthly_299',
  professional_annual: 'price_pro_annual_2990',
  enterprise_monthly: 'price_ent_monthly_799',
  enterprise_annual: 'price_ent_annual_7990',
  cpa_silver_monthly: 'price_cpa_silver_199',
  cpa_gold_monthly: 'price_cpa_gold_399',
  cpa_platinum_monthly: 'price_cpa_plat_499',
};

// Stripe Product metadata for internal tracking
const STRIPE_PRODUCTS = {
  professional: {
    name: 'CERNIQ Professional',
    description: 'ALM platform for single cooperativa or credit union',
    metadata: {
      tier: 'professional',
      seats: '3',
      institutions: '1',
      api_access: 'false',
    },
  },
  enterprise: {
    name: 'CERNIQ Enterprise',
    description: 'Multi-institution ALM platform',
    metadata: {
      tier: 'enterprise',
      seats: '10',
      institutions: '10',
      api_access: 'true',
    },
  },
};
```

---

## 4.2 Webhook Handling

CERNIQ processes three critical Stripe webhook events. Each must be idempotent and acknowledged within 5 seconds.

```typescript
// /api/webhooks/stripe — webhook handler
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  // Idempotency: check if this event was already processed
  const existing = await db.stripeWebhookEvents.findUnique({
    where: { stripe_event_id: event.id },
  });
  if (existing) {
    return new Response('Already processed', { status: 200 });
  }

  // Log event immediately for deduplication
  await db.stripeWebhookEvents.create({
    data: { stripe_event_id: event.id, type: event.type, processed_at: new Date() },
  });

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response('OK', { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { customer, subscription, metadata } = session;
  const leadId = metadata?.lead_id;
  const institutionId = metadata?.institution_id;

  // Update lead status to customer
  if (leadId) {
    await db.leads.update({
      where: { id: leadId },
      data: {
        status: 'customer',
        stripe_customer_id: customer as string,
        stripe_subscription_id: subscription as string,
        converted_at: new Date(),
        mrr_contribution_usd: calculateMRR(session),
      },
    });
  }

  // Provision account access
  await provisionAccount(session);

  // Trigger welcome email via Resend
  await sendWelcomeEmail(session);

  // Log revenue event
  await db.revenueEvents.create({
    data: {
      event_type: 'new_subscription',
      amount_usd: (session.amount_total || 0) / 100,
      stripe_session_id: session.id,
      institution_id: institutionId,
      occurred_at: new Date(),
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const attemptCount = invoice.attempt_count;
  const customerId = invoice.customer as string;

  // Update lead/customer record
  await db.leads.updateMany({
    where: { stripe_customer_id: customerId },
    data: {
      payment_status: 'failed',
      payment_failure_count: attemptCount,
      last_payment_failure_at: new Date(),
    },
  });

  // Trigger dunning sequence based on attempt count
  if (attemptCount === 1) await sendDunningEmail(customerId, 'attempt_1');
  if (attemptCount === 2) await sendDunningEmail(customerId, 'attempt_2');
  if (attemptCount === 3) {
    await sendDunningEmail(customerId, 'final_warning');
    await flagForCSMReview(customerId);
  }
}
```

---

## 4.3 Failed Payment Recovery (Dunning Sequence)

Stripe Smart Retries are enabled. On top of automatic retries, CERNIQ runs a parallel human-touch dunning sequence.

| Attempt | Timing | Action | Channel |
|---|---|---|---|
| Attempt 1 fail | Day 0 | Automated email: "Update your payment method" | Resend email (bilingual) |
| Attempt 2 fail | Day 3 | Email + in-app banner: "Your account access is at risk" | Resend + UI banner |
| Attempt 3 fail | Day 7 | Final email + personal note from Erwin | Resend (personal tone) |
| Grace period end | Day 14 | Account suspended (read-only mode) | In-app notice |
| Win-back trigger | Day 30 | Re-engagement sequence begins | Email + phone |

**Dunning email templates** are stored in `/templates/dunning/` in both ES and EN. The Day 7 email is sent with `from: erwin@cerniq.io` not the system address to signal human escalation.

**Recovery rate target:** 55% of failed payments recovered before Day 14 (industry benchmark for B2B SaaS: 50–65%).

---

## 4.4 Upgrade Path

```
One-Time Report ($299)
        ↓
  [30% off first year offer sent 48hr after report delivery]
        ↓
Professional Monthly ($299/mo)
        ↓
  [Annual upsell: save $598 — offer triggered at 60-day mark]
        ↓
Professional Annual ($2,990/yr)
        ↓
  [Enterprise upsell triggered by: 2nd institution, API usage, >5 users]
        ↓
Enterprise Monthly ($799/mo) or Annual ($7,990/yr)
        ↓
  [Partner upsell: triggered if customer is a CPA/consultant type]
        ↓
CPA Silver → Gold → Platinum
```

### Annual Plan Conversion Incentive

The annual plan offer fires automatically at two moments:
1. **At checkout:** Toggle on pricing page (monthly/annual) shows "2 months free" badge
2. **At 60-day mark:** Automated email to monthly subscribers: "Lock in your rate and get 2 months free — offer expires in 7 days"

```sql
-- Find monthly subscribers eligible for annual conversion offer
SELECT
  l.id,
  l.stripe_customer_id,
  pi.institution_name,
  pi.contact_email,
  l.converted_at,
  EXTRACT(EPOCH FROM (NOW() - l.converted_at)) / 86400 as days_as_customer,
  l.subscription_tier
FROM leads l
JOIN prospect_institutions pi ON l.institution_id = pi.id
WHERE
  l.status = 'customer'
  AND l.subscription_tier = 'professional_monthly'
  AND l.converted_at BETWEEN NOW() - INTERVAL '67 days' AND NOW() - INTERVAL '53 days'
  AND l.annual_offer_sent_at IS NULL
ORDER BY l.converted_at;
```

---

## 4.5 Proration and Mid-Cycle Changes

Stripe handles proration automatically. CERNIQ's configuration:

```javascript
// Upgrade from Professional to Enterprise mid-cycle
const upgradedSubscription = await stripe.subscriptions.update(
  subscriptionId,
  {
    items: [{
      id: currentItemId,
      price: STRIPE_PRICES.enterprise_monthly,
    }],
    proration_behavior: 'create_prorations',  // Immediate proration credit applied
    billing_cycle_anchor: 'unchanged',        // Keep existing billing date
  }
);
```

**Policy:** All upgrades are immediate with proration credit. Downgrades take effect at next billing cycle (no proration). This policy is displayed at checkout and in upgrade flow UI.

---

---

# 5. DEMO → REVENUE INTELLIGENCE

## 5.1 The 6 Demo Analytics Events

Every demo session tracks exactly 6 events. These events are the leading indicators of revenue intent.

| Event Name | Trigger | Revenue Signal Strength |
|---|---|---|
| `DEMO_STARTED` | User lands on `/demo` | Baseline intent (weak) |
| `REPORT_GENERATED` | ALM report successfully generated from demo data | Strong — product has delivered value |
| `PDF_DOWNLOADED` | User downloads the demo PDF | Very strong — ready to present to board |
| `RATE_STRESS_VIEWED` | User clicks rate sensitivity / stress test tab | Strong — engaged with technical depth |
| `ROI_CALCULATED` | User visits `/roi` and completes calculation | Very strong — quantifying purchase decision |
| `LEAD_FORM_OPENED` | User clicks "Get Access" / CTA on demo page | Conversion intent — highest signal |

---

## 5.2 Demo → Revenue Conversion Funnel

```
DEMO_STARTED (100%)
    ↓ 72% complete setup
REPORT_GENERATED (72%)
    ↓ 78% download
PDF_DOWNLOADED (56%)
    ↓ 55% engage further
RATE_STRESS_VIEWED (31%)
    ↓ 45% visit ROI page
ROI_CALCULATED (14%)
    ↓ 68% open lead form
LEAD_FORM_OPENED (9.5%)
    ↓ 65% submit
LEAD_CREATED (6.2%)
    ↓ [Pipeline funnel begins]
```

**Targets:** PDF_DOWNLOADED rate from DEMO_STARTED: **>40%** (current target; if below 40%, investigate demo UX friction). ROI_CALCULATED → LEAD_FORM_OPENED: **>60%** (this is the money moment — users who calculate ROI are highly motivated).

---

## 5.3 Key Leading Indicators for Payment Intent

Ranked by predictive power (based on expected behavioral data):

1. **ROI_CALCULATED + LEAD_FORM_OPENED** — highest signal; close rate >50% from this state
2. **PDF_DOWNLOADED within 24 hours of demo** — indicates user showed report to colleague
3. **Demo session > 12 minutes** — deeply engaged; exploring all sections
4. **Return demo visit (same session_id, second day)** — brought back a decision-maker
5. **RATE_STRESS_VIEWED within first 5 minutes** — technical user; knows what they're looking for
6. **Email opened 3+ times after demo follow-up** — forwarding to internal stakeholders

---

## 5.4 A/B Testing Framework

Two active tests at any time maximum. Each test runs for minimum 200 sessions before evaluating.

**Current Test Candidates:**

| Test | Variant A | Variant B | Metric |
|---|---|---|---|
| Demo CTA copy | "Start Free Trial" | "Generate Your ALM Report" | LEAD_FORM_OPENED rate |
| ROI calculator placement | Bottom of demo page | Persistent sidebar panel | ROI_CALCULATED rate |
| Demo institution selector | Pre-loaded "CoopAhorro San Juan" | User selects from 5 demo cooperativas | DEMO_COMPLETED rate |
| Pricing page layout | Feature comparison table | Value ROI highlight | Checkout initiated rate |

```sql
-- A/B test results query
SELECT
  ab_variant,
  COUNT(DISTINCT session_id) as total_sessions,
  COUNT(DISTINCT CASE WHEN event_name = 'LEAD_FORM_OPENED' THEN session_id END) as conversions,
  ROUND(
    COUNT(DISTINCT CASE WHEN event_name = 'LEAD_FORM_OPENED' THEN session_id END)::numeric /
    COUNT(DISTINCT session_id) * 100, 2
  ) as conversion_rate
FROM demo_analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND ab_test_id = 'demo_cta_copy_v1'
GROUP BY ab_variant;
```

---

## 5.5 ROI Calculator — `/roi` Page

The ROI calculator is a conversion asset, not just a marketing page. It is the quantified justification a CFO needs to approve the purchase.

**Inputs:**
- Institution total assets (slider: $10M–$2B)
- Current ALM consultant spend per year (default: $15,000 — pre-filled)
- Number of board reports per year (default: 4)
- Staff hours per report (default: 40 hours)
- Average staff hourly cost (default: $75)

**Outputs:**
- Annual consultant savings: `consultant_spend - CERNIQ_annual_cost`
- Annual staff time savings: `(reports_per_year × hours_per_report × hourly_cost) - 12_hours_cerniq`
- Total annual ROI: consultant_savings + time_savings
- ROI multiple: total_savings / CERNIQ_annual_cost
- Payback period: `CERNIQ_cost / (savings / 12)` in months

**Integration with Stripe checkout:**
When user clicks "Get This ROI" button, ROI inputs are passed as Stripe checkout session metadata:
```javascript
const session = await stripe.checkout.sessions.create({
  line_items: [{ price: STRIPE_PRICES.professional_monthly, quantity: 1 }],
  metadata: {
    roi_consultant_savings: roiCalcInputs.consultantSpend.toString(),
    roi_total_annual_value: roiCalcOutputs.totalAnnualROI.toString(),
    roi_payback_months: roiCalcOutputs.paybackPeriod.toString(),
    lead_id: leadId,
    institution_id: institutionId,
    source: 'roi_calculator',
  },
});
```

This metadata enables the RevOps-Analyst agent to correlate ROI calculator usage with actual conversion and validate whether the ROI framing is accurate.

---

---

# 6. CPA PARTNER REVENUE ENGINE

## 6.1 Partner Tier Economics

The CPA channel is the single highest-leverage growth mechanism in CERNIQ's GTM. One activated CPA Gold partner generates the revenue equivalent of 3–5 direct Professional accounts, at 70% lower CAC.

### Revenue Share Math

**CPA Gold Example:**
- CPA monthly fixed fee: $399/month
- CPA has 8 cooperativa clients on CERNIQ Professional
- Each cooperativa pays the CPA $399/month (built into retainer or explicit)
- CERNIQ receives from CPA: $399 (fixed) + 20% × (8 × $299) = $399 + $478 = **$877/month**
- CPA nets: $399 × 8 clients - $877 CPA_fee = $3,192 - $877 = **$2,315/month margin**

CPA economics are exceptional for the CPA firm. They add $2,315/month in margin with minimal work beyond onboarding. CERNIQ captures $877/month from a single Gold partner — equivalent to nearly 3 Professional accounts.

### Scenarios at Scale

| CPA Partners | Tier Mix | Monthly Fixed | Rev Share | Total Partner MRR |
|---|---|---|---|---|
| 1 CPA Gold | Gold × 1 | $399 | $478 (8 clients) | $877 |
| 5 CPA Mix | 3 Gold + 2 Platinum | $1,197 + $998 | $1,434 + $900 | $4,529 |
| 10 CPA Mix | 4 Gold + 4 Platinum + 2 Silver | $1,596 + $1,996 + $398 | $2,388 + $1,800 + $239 | $8,417 |

At 10 active CPA partners, the channel contributes **$8,417 MRR** — representing approximately 10% of the $83K MRR target from just 10 relationships versus 170+ direct accounts.

---

## 6.2 Partner Tiers

| Feature | Silver | Gold | Platinum |
|---|---|---|---|
| Client cap | 5 | 15 | Unlimited |
| Monthly fee | $199 | $399 | $499 |
| Revenue share | 20% | 20% | 15% |
| White-label branding | No | Limited (logo) | Full white-label |
| Custom report headers | No | Yes | Yes |
| Dedicated partner portal | No | Yes | Yes |
| Partner manager access | No | No | Yes |
| Quarterly business review | No | No | Yes |
| Co-marketing (webinars) | No | Yes | Yes |

**Silver → Gold upgrade trigger:** 4+ active cooperativa clients. At 4 clients, Gold economics are superior for CPA (more clients allowed, better branding).

**Gold → Platinum upgrade trigger:** 12+ clients, or CPA requests full white-label. Platinum at 15 clients saves CPA $2,235/year vs. 3 separate Gold accounts if they had a different platform.

---

## 6.3 White-Label Billing Flow

```
Cooperativa → [pays CPA firm] → CPA invoices cooperativa $399/mo as part of retainer
CPA firm → [pays CERNIQ] → CERNIQ charges CPA Gold fee ($399) + rev share (20% of $399 × clients)
CERNIQ → [provisions access] → Cooperativa account created under CPA partner umbrella
CERNIQ → [sends branded reports] → Reports show CPA firm's logo + contact info (Gold/Platinum)
```

**Stripe implementation:** CPA partner has a Stripe Connect account (or is billed directly as a regular customer). Rev share is calculated monthly and invoiced as a line item on the CPA's subscription invoice via `stripe.invoiceItems.create()`.

---

## 6.4 Partner Cohort Tracking

```sql
-- Partner cohort health check
SELECT
  p.partner_name,
  p.tier,
  p.activated_at,
  COUNT(c.id) as active_client_count,
  SUM(c.mrr_contribution_usd) as clients_total_mrr,
  p.monthly_fixed_fee_usd,
  ROUND(SUM(c.mrr_contribution_usd) * p.rev_share_pct, 2) as rev_share_earned,
  p.monthly_fixed_fee_usd + ROUND(SUM(c.mrr_contribution_usd) * p.rev_share_pct, 2) as total_partner_mrr,
  MAX(c.last_login_at) as most_recent_client_login,
  EXTRACT(EPOCH FROM (NOW() - MAX(c.last_login_at))) / 86400 as days_since_any_client_login
FROM cpa_partners p
LEFT JOIN leads c ON c.cpa_partner_id = p.id AND c.status = 'customer'
GROUP BY p.id, p.partner_name, p.tier, p.activated_at,
         p.monthly_fixed_fee_usd, p.rev_share_pct
ORDER BY total_partner_mrr DESC;
```

---

## 6.5 Partner Churn Risk Signals

| Signal | Risk Level | Response |
|---|---|---|
| No new clients added in 90 days | MEDIUM | Partner manager check-in; offer co-prospecting support |
| Client count declined by 2+ | HIGH | Urgent partner call; investigate client churn cause |
| CPA firm has not logged in for 30 days | MEDIUM | Automated re-engagement email |
| CPA firm posted negative review of any fintech tool | HIGH | Proactive relationship call |
| CPA firm's practice acquired or merged | CRITICAL | Immediate call with new management; re-contract |
| CPA clients hitting payment failures | HIGH | Flag to partner — their reputation is at stake |

**Partner churn is catastrophically expensive:** losing one CPA Gold partner with 10 clients is the equivalent of losing 10 Professional direct accounts simultaneously. Partners receive white-glove treatment regardless of tier.

---

---

# 7. CHURN PREVENTION PROTOCOL

## 7.1 Early Warning Signals

The system monitors 7 behavioral signals as churn precursors. Any 2 signals in a 14-day window trigger immediate CSM review.

| Signal | Detection Method | Churn Correlation |
|---|---|---|
| Login frequency drop >50% week-over-week | Auth log analysis | Very High |
| No reports generated in 21+ days | report_events table | High |
| Support ticket with negative sentiment | Ticket tagging + NLP | High |
| Viewed cancellation page | Page analytics event | Very High |
| Downgraded plan (Enterprise → Pro) | Stripe subscription change | High |
| NPS score ≤ 6 | Post-report NPS modal | High |
| Annual renewal date within 45 days, no renewal signal | Stripe subscription metadata | Medium-High |

---

## 7.2 Health Score Formula

```
HealthScore = (LoginScore × 0.25) + (UsageScore × 0.30) + (OutcomeScore × 0.25) + (SentimentScore × 0.20)
```

| Component | 100 Points | 50 Points | 0 Points |
|---|---|---|---|
| LoginScore | ≥3 logins/week | 1–2 logins/week | No login in 14+ days |
| UsageScore | ≥2 reports/month | 1 report/month | No reports in 30+ days |
| OutcomeScore | NPS ≥9, no support tickets | NPS 7–8, 1 ticket | NPS ≤6, 2+ tickets |
| SentimentScore | Positive email replies, referral given | Neutral | Negative tickets, cancellation inquiry |

```sql
-- Health score calculation query
SELECT
  l.id as lead_id,
  pi.institution_name,
  l.subscription_tier,
  l.converted_at,

  -- Login score component
  CASE
    WHEN (SELECT COUNT(*) FROM auth_events ae WHERE ae.institution_id = l.institution_id
          AND ae.created_at >= NOW() - INTERVAL '7 days') >= 3 THEN 100
    WHEN (SELECT COUNT(*) FROM auth_events ae WHERE ae.institution_id = l.institution_id
          AND ae.created_at >= NOW() - INTERVAL '7 days') >= 1 THEN 50
    ELSE 0
  END as login_score,

  -- Usage score component
  CASE
    WHEN (SELECT COUNT(*) FROM report_events re WHERE re.institution_id = l.institution_id
          AND re.created_at >= NOW() - INTERVAL '30 days') >= 2 THEN 100
    WHEN (SELECT COUNT(*) FROM report_events re WHERE re.institution_id = l.institution_id
          AND re.created_at >= NOW() - INTERVAL '30 days') = 1 THEN 50
    ELSE 0
  END as usage_score

FROM leads l
JOIN prospect_institutions pi ON l.institution_id = pi.id
WHERE l.status = 'customer'
ORDER BY login_score + usage_score ASC;  -- Lowest health first
```

---

## 7.3 At-Risk Account Playbook

### 30-Day Intervention (HealthScore 40–60)
- Automated in-app banner: "Tip: Generate your Q2 ALM report before COSSEC season"
- Email: educational content specific to their asset size / COSSEC status
- Offer: free 30-minute ALM strategy call with Erwin
- Goal: restore usage, validate product is delivering value

### 60-Day Intervention (HealthScore 20–39)
- Personal email from Erwin: "I noticed you haven't generated a report recently — is everything okay?"
- Phone outreach (CFO direct if available)
- Offer: free report generation walkthrough, live
- Goal: identify and solve the specific problem preventing usage

### 90-Day Intervention (HealthScore 0–19)
- CSM escalation: "save call" — no selling, only listening
- Offer: 2-month credit if they commit to 1 more quarter
- If reason is budget: offer Professional → annual plan at locked rate
- If reason is competitor: request a feature comparison conversation
- Goal: convert to annual plan or identify competitive intelligence

---

## 7.4 Win-Back Sequence for Churned Accounts

Post-churn, a 5-email win-back sequence runs over 90 days:

| Day | Email Theme | Offer |
|---|---|---|
| Day 7 | "We made changes based on your feedback" | Free 30-day reactivation |
| Day 30 | COSSEC regulatory update relevant to their institution | "Come back to see your updated benchmark" |
| Day 60 | Case study: cooperativa like theirs that saved $18K with CERNIQ | 50% off first month back |
| Day 75 | "One-click reactivation — your data is still here" | Same plan, locked pricing |
| Day 90 | Final: personalized note from Erwin + phone call | Negotiated |

Win-back target rate: 20% of churned accounts within 90 days.

---

## 7.5 NPS Integration

NPS is collected via an in-product modal triggered 7 days after first report generation, and quarterly thereafter.

**Response protocol:**
- NPS 9–10 (Promoters): Automated referral ask within 24 hours
- NPS 7–8 (Passives): Feature request survey; 30-day check-in
- NPS 0–6 (Detractors): Immediate CSM call (within 48 hours); root cause identification; health score flags RED

```sql
-- NPS response tracking
SELECT
  nps_score,
  COUNT(*) as responses,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as pct,
  CASE
    WHEN nps_score >= 9 THEN 'Promoter'
    WHEN nps_score >= 7 THEN 'Passive'
    ELSE 'Detractor'
  END as category
FROM nps_responses
WHERE submitted_at >= NOW() - INTERVAL '90 days'
GROUP BY nps_score
ORDER BY nps_score DESC;
```

---

---

# 8. REVENUE OPS CLI AGENTS

## 8.1 RevOps-Monitor — Daily Pipeline Watchdog

**Purpose:** Runs once per day (07:00 AST). Checks pipeline health, flags stale deals, computes MRR delta, and delivers a morning briefing to Erwin.

**Full Master Prompt:**

```
You are RevOps-Monitor, the daily revenue operations agent for CERNIQ, an ALM SaaS platform serving Puerto Rico cooperativas and credit unions. Your job is to run every morning at 07:00 AST and deliver a concise, actionable pipeline briefing.

DATABASE: You have read access to the CERNIQ PostgreSQL database (connection via DATABASE_URL environment variable). The relevant tables are: leads, prospect_institutions, revenue_events, stripe_subscriptions, demo_analytics_events, cpa_partners.

DAILY TASKS — execute in this order:

1. PIPELINE SNAPSHOT
Run the full pipeline health SQL query. Report:
- Total leads by status and priority
- Total pipeline value ($USD) in active stages (engaged, demo_scheduled, demo_completed, trial)
- Count of HIGH priority leads with next_follow_up overdue by >1 day

2. STALE DEAL ALERT
Find all leads in status contacted/engaged/demo_scheduled/demo_completed with no update in >5 days. For each, output:
- Institution name, status, priority, lead score, days stale, assigned contact name

3. MRR DELTA
Compute MRR change vs. 7 days ago:
- New MRR this week (new customers converted)
- Churned MRR this week (subscriptions deleted)
- Net MRR delta
- Current total MRR
- ARR run rate

4. PAYMENT FAILURES
Query leads table for any customer with payment_status = 'failed' and payment_failure_count > 0. List institution name, failure count, last failure date, dunning email status.

5. DEMO FUNNEL CHECK
For demos in the last 7 days, compute:
- DEMO_STARTED count
- PDF_DOWNLOADED rate
- LEAD_FORM_OPENED rate
- If PDF_DOWNLOADED rate < 40%, flag as ATTENTION REQUIRED

6. BRIEFING FORMAT
Output a markdown briefing titled "## CERNIQ RevOps Morning Brief — [DATE]" with 5 sections matching the tasks above. Use tables where possible. End with "PRIORITY ACTIONS TODAY:" listing the top 3 actions Erwin should take, ranked by revenue impact.

TONE: Direct, data-driven, no fluff. This is an internal operator tool, not a customer-facing report.

DATABASE QUERIES: Use the SQL patterns from the CERNIQ_Vol7 Revenue Intelligence Bible. Always use parameterized queries for safety. Log your query results before synthesizing the briefing.

ESCALATION: If MRR delta is negative week-over-week, add a RED ALERT section at the top of the briefing.
```

---

## 8.2 RevOps-Analyst — Weekly Cohort Intelligence

**Purpose:** Runs every Monday at 08:00 AST. Performs cohort analysis, computes LTV/CAC ratios, builds the weekly revenue report for Erwin and board visibility.

**Full Master Prompt:**

```
You are RevOps-Analyst, the weekly revenue intelligence agent for CERNIQ. You run every Monday morning and produce the definitive weekly revenue report. This report feeds Erwin's board updates and investor communications.

DATABASE: Full read access to CERNIQ PostgreSQL. Key tables: leads, revenue_events, stripe_subscriptions, nps_responses, demo_analytics_events, cpa_partners, prospect_institutions, cooperative_benchmarks.

WEEKLY TASKS — produce in a single markdown document titled "CERNIQ Weekly Revenue Intelligence — Week of [DATE]":

SECTION 1: MRR WATERFALL
Build a waterfall showing:
- Starting MRR (last Monday)
- + New MRR (new subscriptions)
- + Expansion MRR (upgrades: Pro→Enterprise, monthly→annual)
- - Churned MRR (cancelled subscriptions)
- - Contraction MRR (downgrades)
- = Ending MRR
- Net Revenue Retention (NRR) = (Ending MRR - Churned - Contraction) / Starting MRR × 100

SECTION 2: COHORT ANALYSIS
For each monthly cohort of customers (group by month of first payment):
- Original cohort size
- % still active
- Average MRR per remaining account
- Expansion revenue generated by cohort
Plot as a retention table: Cohort × Month 1, Month 2, Month 3, Month 6, Month 12

SECTION 3: LTV / CAC BY CHANNEL
For each acquisition channel (outbound_direct, cpa_referral, inbound_demo, referral):
- Customer count acquired this quarter
- Total acquisition cost (estimate based on time × channel rate)
- Average LTV (MRR at conversion × 50 months at 2% churn)
- LTV:CAC ratio
- Payback period

SECTION 4: PIPELINE COVERAGE RATIO
Pipeline Coverage = Total Active Pipeline Value / Monthly Revenue Target
Target: 3x coverage minimum. Flag if below 2x.
Compute for each stage (engaged → trial) separately.

SECTION 5: CPA PARTNER HEALTH
For each CPA partner:
- Active client count vs. tier capacity
- Revenue contribution (fixed + rev share)
- Month-over-month client count trend
- Days since last activity
- Health status: GREEN/YELLOW/RED

SECTION 6: DEMO FUNNEL ANALYTICS (LAST 7 DAYS)
All 6 events with count, rate from DEMO_STARTED, and week-over-week delta.
Flag any event with rate decline >5 percentage points.

SECTION 7: PROJECTIONS
Given current MRR growth rate (calculate rolling 4-week average), project:
- MRR at end of current quarter
- MRR at end of next quarter
- Months to $83,333 MRR at current trajectory
- Gap to $1M ARR target (in dollars and in accounts needed)

SECTION 8: TOP 3 REVENUE RISKS THIS WEEK
Based on all data above, identify the 3 highest-priority risks to the MRR roadmap. For each: name the risk, quantify the MRR at risk, suggest one mitigation action.

SECTION 9: RECOMMENDED ACTIONS
Top 5 actions for the week, ranked by expected MRR impact. Format: Action | Expected Impact | Owner | Deadline.

OUTPUT: Markdown format. All financial figures in USD. All percentages rounded to 1 decimal place. Deliver to Erwin via email (use RESEND_API_KEY from environment) and save as /reports/weekly/CERNIQ_Weekly_[YYYY-MM-DD].md.
```

---

## 8.3 RevOps-Stripe — Payment Health Monitor

**Purpose:** Runs continuously (every 15 minutes via cron) and after each Stripe webhook event. Monitors subscription health, flags anomalies, triggers dunning, and maintains payment integrity.

**Full Master Prompt:**

```
You are RevOps-Stripe, the payment health monitoring agent for CERNIQ. You watch Stripe in real-time and act as the revenue protection layer between payment events and business operations.

ENVIRONMENT: You have access to:
- STRIPE_SECRET_KEY (read all Stripe data, trigger some actions)
- DATABASE_URL (read/write leads, revenue_events, stripe_webhook_events tables)
- RESEND_API_KEY (send transactional emails)
- ADMIN_KEY (access /admin/leads API for status updates)

MONITORING TASKS (run every 15 minutes):

TASK 1: SUBSCRIPTION HEALTH CHECK
Query Stripe for all active subscriptions. For each subscription:
- Verify it has a corresponding 'customer' status lead in CERNIQ DB
- Flag any orphaned Stripe subscriptions (in Stripe but not in DB)
- Flag any DB customers without a corresponding active Stripe subscription
- Report count of subscriptions by status: active, past_due, canceled, trialing

TASK 2: FAILED PAYMENT SCAN
Query Stripe invoices with status = 'open' or 'uncollectible' in the last 30 days:
- For each: customer ID, institution name (look up in DB), amount, failure date, attempt count
- Verify dunning emails have been sent (check leads.payment_failure_dunning_sent_at)
- For any failure where dunning email is overdue: trigger via Resend API immediately
- Log all dunning actions to revenue_events table with event_type = 'dunning_sent'

TASK 3: UPGRADE OPPORTUNITY DETECTION
Monthly subscribers who:
(a) Have been active for 58–62 days: queue for annual conversion offer
(b) Have generated 3+ reports this month: flag as expansion candidate for Enterprise upsell
(c) Institution type is CPA/consultant: flag for CPA partner tier upsell

Query and output as table: institution_name | current_tier | days_active | reports_this_month | recommended_action

TASK 4: CHURN RISK PAYMENT SIGNALS
For subscriptions with upcoming renewal in 7–14 days AND health_score < 50:
- Flag as AT_RISK_RENEWAL
- Trigger pre-renewal retention email if not already sent
- Add to CSM review queue

TASK 5: REVENUE RECONCILIATION
Every hour: compare sum of all active Stripe subscription amounts vs. CERNIQ DB leads.mrr_contribution_usd total. If discrepancy > $50: alert immediately with breakdown of which records differ.

ANOMALY DETECTION:
Alert immediately (do not wait for next cycle) if:
- MRR drops by >$500 in any 1-hour window (mass cancellation signal)
- 3+ payment failures in any 1-hour window (payment processor issue signal)
- Any Stripe webhook arrives with an event_id CERNIQ has not seen before that doesn't match known event types
- Stripe API latency > 5 seconds (infrastructure issue signal)

DUNNING SEQUENCE EXECUTION:
When handling invoice.payment_failed webhook:
Attempt 1 (attempt_count = 1):
  - Send email template: dunning_attempt_1_[es|en] via Resend
  - Update leads.payment_failure_dunning_stage = 'attempt_1'

Attempt 2 (attempt_count = 2, Day 3):
  - Send email template: dunning_attempt_2_[es|en]
  - Add in-app banner flag to institution record
  - Update dunning_stage = 'attempt_2'

Attempt 3 (attempt_count = 3, Day 7):
  - Send email template: dunning_final_[es|en] (from: erwin@cerniq.io)
  - POST to /admin/leads API to flag for manual CSM review
  - Update dunning_stage = 'final_warning'

Grace period end (Day 14, no payment):
  - Suspend account (set institution.access_status = 'suspended')
  - Send suspension notice email
  - Update leads.status = 'at_risk' (not 'churned' — still recoverable)

OUTPUT FORMAT: Each run produces a JSON log entry saved to /logs/stripe-monitor/[YYYY-MM-DD-HH-mm].json with: run_timestamp, tasks_completed, anomalies_detected, actions_taken, mrr_snapshot, next_run_at.

CRITICAL: Never cancel a Stripe subscription without explicit human confirmation. Never issue refunds autonomously. Flag these actions and await confirmation from ADMIN_KEY-authenticated session.
```

---

---

# 9. BOARD-LEVEL REVENUE METRICS

## 9.1 Core Dashboard Definitions

Every metric has a precise definition. When reporting to Erwin or board, use these exact definitions — no variations.

| Metric | Definition | Formula | Reporting Frequency |
|---|---|---|---|
| **MRR** | Monthly Recurring Revenue | Sum of all active subscriptions normalized to monthly | Daily |
| **ARR** | Annual Recurring Revenue | MRR × 12 | Weekly |
| **New MRR** | MRR added from new customers | Sum of new subscriptions this period | Weekly |
| **Expansion MRR** | MRR added from upgrades | Upgraded subscription delta vs. prior | Weekly |
| **Churned MRR** | MRR lost to cancellation | Sum of cancelled subscription MRR | Weekly |
| **Contraction MRR** | MRR lost to downgrade | Downgraded subscription delta | Weekly |
| **Net MRR Churn** | Net MRR impact of losses | (Churned MRR + Contraction MRR) - Expansion MRR | Weekly |
| **NRR** | Net Revenue Retention | (MRR_end - Churned - Contraction) / MRR_start × 100 | Monthly |
| **GRR** | Gross Revenue Retention | (MRR_end - Churned) / MRR_start × 100 (no expansion) | Monthly |
| **CAC** | Customer Acquisition Cost | Total sales + marketing spend / new customers acquired | Monthly |
| **LTV** | Lifetime Value | ARPU / Monthly Churn Rate | Monthly |
| **LTV:CAC** | LTV to CAC Ratio | LTV / CAC | Monthly |
| **Payback Period** | Months to recover CAC | CAC / (ARPU × Gross Margin %) | Monthly |
| **Pipeline Value** | Total $ value of active leads | Sum of pipeline_value_usd for non-closed leads | Daily |
| **Win Rate** | % of qualified leads closed | Customers / Qualified Leads | Monthly |
| **Demo→Paid** | Trial-to-paid conversion | Paid / Demos completed | Weekly |

---

## 9.2 Weekly Metrics Format — Monday Email to Erwin

```
Subject: CERNIQ Revenue Brief — Week of [DATE]

## CERNIQ Weekly Revenue Snapshot

### The Number
MRR: $[X,XXX] | ARR Run Rate: $[XX,XXX] | Target Gap: $[XX,XXX]
Progress to $1M ARR: [X]% | On track: [YES/NO/BEHIND]

### MRR Waterfall This Week
Starting MRR:    $XX,XXX
+ New MRR:       +$X,XXX  ([N] new customers)
+ Expansion MRR: +$XXX    ([N] upgrades)
- Churned MRR:   -$XXX    ([N] cancellations)
- Contraction:   -$0
= Ending MRR:    $XX,XXX  ([+/-X.X%] WoW)

### Pipeline Health
Active Pipeline: $XX,XXX ([N] qualified leads)
Pipeline Coverage: [X.X]x (Target: 3x)
Stale Deals (>5 days): [N] — [names if <5]
Demos Booked This Week: [N]

### CPA Channel
Active Partners: [N] | Partner MRR: $X,XXX
New CPA Prospects in Pipeline: [N]

### Demo Funnel (Last 7 Days)
DEMO_STARTED: [N] | PDF_DOWNLOADED: [N] ([X%]) | LEAD_FORM_OPENED: [N] ([X%])

### 3 Actions Needed From You This Week
1. [Specific action — person to call, deal to close, decision needed]
2. [Specific action]
3. [Specific action]
```

---

## 9.3 Monthly Board Update Template

```markdown
# CERNIQ Board Update — [MONTH YEAR]

## TL;DR
[3 bullet points: biggest win, biggest challenge, most important decision needed]

## Revenue
| Metric | This Month | Last Month | Target | Status |
|---|---|---|---|---|
| MRR | $X | $X | $X | 🟢/🟡/🔴 |
| ARR | $X | $X | $X | |
| New MRR | $X | $X | $X | |
| NRR | X% | X% | >100% | |
| Churn Rate | X% | X% | <2% | |

## Pipeline
- Qualified leads: [N] ($[X] pipeline value)
- Demos completed: [N] (conversion rate: [X%])
- Accounts closed this month: [N] ([tier breakdown])
- CPA partners active: [N] (pipeline from CPA: [X%] of total)

## Product & Operations
[Key product updates, infrastructure events, support metrics]

## Key Decisions Needed
1. [Decision with options and recommendation]

## Next Month Priorities
1. [Priority with owner and expected impact]
```

---

## 9.4 Investor-Ready Metric Definitions

When preparing for any fundraising conversation (even informal), use these exact definitions consistent with SaaS investor standards:

- **MRR** includes only contractually recurring revenue. One-time report fees are excluded from MRR and reported separately as "transactional revenue."
- **NRR** is calculated on the same set of customers from 12 months ago. Customers acquired in the trailing 12 months are excluded from the numerator and denominator.
- **CAC** includes Erwin's fully-loaded cost allocated to sales activity (% of time × salary equivalent), email tooling, and any paid acquisition. Does NOT include product development costs.
- **LTV** uses actual observed churn rate from the first customer cohort once N>10. Until N>10, use modeled 2% monthly churn.
- **Gross Margin** is computed on recognized revenue only, against direct COGS as defined in Section 1.4 of this document. Engineering salaries are NOT included in COGS (they are OpEx).

---

---

# 10. REVENUE OPERATIONS CALENDAR

## 10.1 Daily Automated Actions (No Human Required)

| Time (AST) | Action | Agent | Output |
|---|---|---|---|
| 07:00 | RevOps-Monitor runs pipeline snapshot | RevOps-Monitor | Morning brief → Erwin email |
| 07:15 | Stripe payment health check | RevOps-Stripe | Anomaly log; dunning triggers if needed |
| 08:00 | Stale deal alerts processed | RevOps-Monitor | Leads with overdue follow-ups flagged in /admin/leads |
| Continuous | Webhook processing (Stripe events) | RevOps-Stripe | Real-time subscription state updates |
| Continuous | Demo analytics event tracking | Platform | Demo funnel metrics updated |
| 23:00 | Daily MRR snapshot saved to DB | RevOps-Monitor | Historical MRR record for waterfall reporting |

---

## 10.2 Weekly Actions

| Day | Action | Owner | Output |
|---|---|---|---|
| Monday 08:00 | RevOps-Analyst weekly revenue report runs | RevOps-Analyst | Weekly report → Erwin + /reports/weekly/ |
| Monday 09:00 | Erwin reviews pipeline, assigns follow-up priority | Erwin | Updated next_follow_up dates in leads |
| Wednesday | Demo follow-up check: any demo_completed leads without response in 4+ days | Erwin / RevOps-Monitor | Re-engagement emails sent |
| Thursday | CPA partner check-in emails (if no activity this week) | Automated / Erwin | Partner re-engagement |
| Friday | Weekly conversion analysis: which demos this week converted | RevOps-Analyst | Learnings for next week outreach |
| Friday 17:00 | Weekly MRR lock: final number for the week | RevOps-Monitor | Logged to weekly_mrr_snapshots table |

---

## 10.3 Monthly Actions

| Week | Action | Owner | Output |
|---|---|---|---|
| Month End W1 | Full cohort analysis (all customer cohorts) | RevOps-Analyst | Retention table, NRR calculation |
| Month End W1 | Pricing review: are we leaving money on the table? | Erwin | Pricing adjustment decision memo |
| Month End W2 | Partner health check: all CPA partners reviewed | Erwin | At-risk partners flagged; QBR scheduled if needed |
| Month End W2 | Annual plan conversion push: eligible monthly subscribers contacted | Automated | Annual conversion emails sent |
| Month End W3 | NPS analysis: Promoters asked for referrals | Automated | Referral request emails sent |
| Month End W3 | Churn post-mortems: any churn this month reviewed | Erwin | Churn analysis document; product feedback logged |
| Month End W4 | Monthly board update drafted | RevOps-Analyst | Draft → Erwin for review |
| Month End W4 | CAC and LTV updated with actual data | RevOps-Analyst | Unit economics dashboard refreshed |

---

## 10.4 Quarterly Actions

| Quarter | Action | Owner | Output |
|---|---|---|---|
| Q-end W1 | Pricing strategy review: test new price point for new customers | Erwin | Pricing decision (raise / hold / test) |
| Q-end W1 | Expansion planning: new segments (NCUA CUs, mainland diaspora)? | Erwin | Segment entry decision memo |
| Q-end W2 | CPA partner annual review: tier upgrades / downgrades | Erwin | Partner tier adjustments; Platinum candidates identified |
| Q-end W2 | Full LTV:CAC audit by acquisition channel | RevOps-Analyst | Channel ROI ranking; budget allocation recommendation |
| Q-end W3 | Competitive intelligence refresh | Erwin | Positioning updates to sales materials |
| Q-end W3 | Annual plan renewal campaign (for accounts on annual plans renewing next quarter) | Automated + Erwin | Renewal retention emails; at-risk renewals identified |
| Q-end W4 | Board / investor update preparation | RevOps-Analyst + Erwin | Quarterly board deck; investor letter if applicable |
| Q-end W4 | Decision gate review (Section 2.4): which gates have been hit? | Erwin | Next quarter decisions: hire, price, expand |

---

## 10.5 Revenue Ops SQL Reference Sheet

```sql
-- QUICK REFERENCE: Most-Used RevOps Queries

-- Current MRR snapshot
SELECT
  subscription_tier,
  COUNT(*) as accounts,
  SUM(mrr_contribution_usd) as mrr,
  AVG(mrr_contribution_usd) as arpu
FROM leads
WHERE status = 'customer'
GROUP BY subscription_tier
ORDER BY mrr DESC;

-- ARR run rate
SELECT SUM(mrr_contribution_usd) * 12 as arr_run_rate
FROM leads WHERE status = 'customer';

-- Monthly new MRR (current month)
SELECT
  DATE_TRUNC('month', converted_at) as month,
  COUNT(*) as new_customers,
  SUM(mrr_contribution_usd) as new_mrr
FROM leads
WHERE status = 'customer'
  AND converted_at >= DATE_TRUNC('month', NOW())
GROUP BY 1;

-- Churn this month
SELECT
  COUNT(*) as churned_accounts,
  SUM(mrr_contribution_usd) as churned_mrr
FROM leads
WHERE status = 'churned'
  AND churned_at >= DATE_TRUNC('month', NOW());

-- NRR calculation (trailing 12 months)
WITH base_cohort AS (
  SELECT id, mrr_contribution_usd as base_mrr
  FROM leads
  WHERE status IN ('customer', 'churned')
    AND converted_at <= NOW() - INTERVAL '12 months'
),
current_state AS (
  SELECT l.id, l.mrr_contribution_usd as current_mrr, l.status
  FROM leads l
  JOIN base_cohort bc ON l.id = bc.id
)
SELECT
  SUM(base_cohort.base_mrr) as starting_mrr,
  SUM(CASE WHEN current_state.status = 'customer' THEN current_state.current_mrr ELSE 0 END) as ending_mrr,
  ROUND(
    SUM(CASE WHEN current_state.status = 'customer' THEN current_state.current_mrr ELSE 0 END) /
    NULLIF(SUM(base_cohort.base_mrr), 0) * 100,
  2) as nrr_pct
FROM base_cohort
JOIN current_state ON base_cohort.id = current_state.id;

-- Top 10 highest-value pipeline opportunities (weighted by lead score × pipeline value)
SELECT
  pi.institution_name,
  l.status,
  l.priority,
  l.lead_score,
  l.pipeline_value_usd,
  ROUND(l.lead_score * l.pipeline_value_usd / 100.0, 2) as weighted_pipeline_value,
  l.next_follow_up,
  pi.contact_email
FROM leads l
JOIN prospect_institutions pi ON l.institution_id = pi.id
WHERE l.status NOT IN ('customer', 'churned', 'disqualified', 'lost')
ORDER BY weighted_pipeline_value DESC
LIMIT 10;

-- Partner revenue contribution breakdown
SELECT
  cp.partner_name,
  cp.tier,
  cp.monthly_fixed_fee_usd,
  COUNT(l.id) as active_clients,
  SUM(l.mrr_contribution_usd) as client_total_mrr,
  ROUND(SUM(l.mrr_contribution_usd) * cp.rev_share_pct, 2) as rev_share_monthly,
  cp.monthly_fixed_fee_usd + ROUND(SUM(l.mrr_contribution_usd) * cp.rev_share_pct, 2) as total_partner_contribution
FROM cpa_partners cp
LEFT JOIN leads l ON l.cpa_partner_id = cp.id AND l.status = 'customer'
GROUP BY cp.id, cp.partner_name, cp.tier, cp.monthly_fixed_fee_usd, cp.rev_share_pct
ORDER BY total_partner_contribution DESC;
```

---

---

## Appendix A: Revenue Intelligence Glossary

| Term | Definition |
|---|---|
| **MRR** | Monthly Recurring Revenue — normalized monthly value of all active subscriptions |
| **ARR** | Annual Recurring Revenue — MRR × 12 |
| **NRR** | Net Revenue Retention — measures expansion vs. churn within existing customer base; >100% = growth without new customers |
| **GRR** | Gross Revenue Retention — measures retention excluding expansion; floor metric |
| **CAC** | Customer Acquisition Cost — total spend to acquire one new paying customer |
| **LTV** | Lifetime Value — expected total revenue from a customer over their relationship with CERNIQ |
| **ARPU** | Average Revenue Per User (account) — MRR / active accounts |
| **ACV** | Annual Contract Value — annual value of a single customer contract |
| **TCV** | Total Contract Value — total value including multi-year commitments |
| **Churn Rate** | % of MRR lost per month from cancellations and downgrades |
| **Pipeline Coverage** | Active pipeline value / monthly revenue target; 3x is minimum healthy |
| **Win Rate** | Qualified leads that close as customers / total qualified leads |
| **Demo Conversion** | % of demo completions that result in trial or paid conversion |
| **Payback Period** | Months required to recover CAC from gross profit |
| **Dunning** | Automated payment recovery sequence for failed/declined payments |
| **Rev Share** | % of client subscription revenue shared with CPA partner |
| **PLG** | Product-Led Growth — growth driven by product usage (demo, self-serve trial) |
| **CSM** | Customer Success Manager — owner of customer health post-sale |
| **QBR** | Quarterly Business Review — structured partner/customer health call |

---

## Appendix B: Key Thresholds and Alert Triggers

| Metric | Green | Yellow | Red | Action |
|---|---|---|---|---|
| Monthly Churn Rate | <2% | 2–3.5% | >3.5% | Red: Emergency churn audit |
| NRR | >110% | 100–110% | <100% | Red: Expansion playbook activated |
| Pipeline Coverage | >3x | 2–3x | <2x | Red: Outbound sprint launched |
| PDF_DOWNLOADED Rate | >40% | 30–40% | <30% | Red: Demo UX review |
| CPA Client Adds/Month | >2 | 1–2 | 0 | Red: Partner manager call |
| Failed Payment Recovery | >55% | 40–55% | <40% | Red: Dunning sequence review |
| Demo→Paid Conversion | >30% | 20–30% | <20% | Red: Demo optimization sprint |
| LTV:CAC | >10x | 5–10x | <5x | Red: CAC reduction review |

---

*CERNIQ Vol. 7: Revenue Intelligence Bible — Internal Operations Document*
*Version 1.0 | April 2026 | Confidential*
*Next review: July 2026 (Q2 close) or when MRR hits $15,000 — whichever comes first*
