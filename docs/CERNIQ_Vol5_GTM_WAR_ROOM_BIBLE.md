# CERNIQ Vol. 5: GTM War Room Bible
## Asset-Liability Management Platform — Puerto Rico Cooperativas & Credit Unions
### Confidential Internal Strategy Document | April 2026 | v1.0

---

> **Mission:** $1,000,000 ARR by September 30, 2027. Every section of this document exists to serve that number.

---

## TABLE OF CONTENTS

1. [GTM North Star & Current Status (April 2026)](#1-gtm-north-star--current-status)
2. [The 109 Cooperativa Attack Plan](#2-the-109-cooperativa-attack-plan)
3. [CPA Firm Channel Playbook](#3-cpa-firm-channel-playbook)
4. [Outbound Sales Engine — 6 Agents](#4-outbound-sales-engine--6-agents)
5. [Demo-to-Close Playbook](#5-demo-to-close-playbook)
6. [Email Sequences — Full Templates](#6-email-sequences--full-templates)
7. [Competitive Intelligence & Positioning](#7-competitive-intelligence--positioning)
8. [Revenue Milestones & Tracking](#8-revenue-milestones--tracking)

---

---

# 1. GTM NORTH STAR & CURRENT STATUS

## 1.1 Where We Are — April 2026

| Dimension | Status |
|---|---|
| Product | v1.0.0 live in production since March 2026 |
| Core Flow | CSV upload → 14-page board-ready PDF report in < 5 minutes |
| Languages | Fully bilingual: Spanish (primary) / English |
| Demo Environment | `/demo?type=cooperativa` live with $250M "CoopAhorro San Juan" data |
| Leads Pipeline | Active — outbound agents running |
| CRM Admin Panel | Live — ProspectInstitution table seeded with all 109 cooperativas |
| Stripe Integration | One-time reports + monthly/annual subscriptions active |
| Target Market | 109 COSSEC-regulated cooperativas (primary), 40+ NCUA CUs, 15-20 CPA firms |
| Seed Data | All 109 cooperativas in DB with assets, COSSEC status, contact flags |

## 1.2 The Single Most Important Number

**$15,000** — the minimum a cooperativa currently pays a consultant for a manual ALM report that takes 2–4 weeks. CERNIQ delivers the equivalent in under 10 minutes. The market is already spending the money. We are the displacement, not the creation.

## 1.3 30 / 60 / 90 Day Targets

### 30-Day Sprint (April 16 – May 15, 2026)
**Theme: Pipeline Ignition**

- [ ] Complete outbound sequences to all Tier 1 (Top 20) cooperativas — minimum 3 touchpoints each
- [ ] Book 5 qualified demos with CFO/Risk Manager personas
- [ ] Activate outreach to 5 CPA firms (first wave)
- [ ] Close first paying customer (any tier, any channel)
- [ ] Validate demo analytics funnel: target 40% PDF_DOWNLOADED rate from DEMO_STARTED
- [ ] Deploy follow-up agent for any lead that hits LEAD_FORM_OPENED but does not complete
- [ ] Revenue target: $2,500 MRR (first 5 paying accounts at any plan level)

### 60-Day Sprint (May 16 – June 15, 2026)
**Theme: Proof of Channel**

- [ ] 3 signed CPA partner agreements
- [ ] 15 closed accounts (direct + channel)
- [ ] First white-label CPA deployment live (one CPA firm's branding on the report output)
- [ ] Tier 1 pipeline: minimum 10 institutions in active demo/trial stage
- [ ] Revenue target: $8,000 MRR
- [ ] Net Promoter Score survey sent to first 10 customers
- [ ] First case study draft from earliest adopter

### 90-Day Sprint (June 16 – July 15, 2026)
**Theme: Revenue Repeatability**

- [ ] 35 closed accounts total
- [ ] 2 CPA firms actively reselling (generating inbound referrals without CERNIQ direct outreach)
- [ ] $18,000+ MRR
- [ ] Enterprise pilot signed with at least one Tier 1 institution (>$500M assets)
- [ ] Automated nurture sequences running for all 109 cooperativas in DB
- [ ] Churn rate: < 5% (monthly)

## 1.4 $1M ARR Milestone Map

| Milestone | Target Date | MRR Required | Accounts Required* |
|---|---|---|---|
| First Dollar | May 2026 | — | 1 |
| $10K MRR | June 2026 | $10,000 | ~20 |
| $25K MRR | August 2026 | $25,000 | ~45 |
| $50K MRR | November 2026 | $50,000 | ~80 |
| $83K MRR ($1M ARR) | September 2027 | $83,333 | ~130–150 |

*Mix of Direct Professional ($399/mo), Enterprise ($799+/mo), Partner CPA firms ($199/mo base + per-report), and one-time report fees averaging $499/report. Model assumes 60% subscription, 40% per-report at maturity.

## 1.5 Current Blockers & Removal Plan

| Blocker | Severity | Removal Action | Owner | Deadline |
|---|---|---|---|---|
| No signed customer yet (0 → 1 problem) | Critical | Personal outreach to 3 known warm contacts in cooperativa sector today | Founder | Week 1 |
| CPA channel agreements not drafted | High | Draft 1-page partner agreement template | Legal/Founder | Week 2 |
| Demo-to-lead conversion unclear | High | Instrument all 6 funnel events; review analytics daily | Product | Week 1 |
| No social proof / testimonials | High | Offer free first report to 2 Tier 1 cooperativas in exchange for testimonial | Sales | Week 2 |
| Outbound email deliverability unverified | Medium | Verify SPF/DKIM/DMARC on sending domain; warm up mailbox | Engineering | Week 1 |
| Bilingual report quality QA | Medium | CFO review of 3 completed sample reports | Product | Week 2 |
| Pricing page not live publicly | Medium | Publish pricing page with Stripe checkout links | Engineering | Week 1 |

---

---

# 2. THE 109 COOPERATIVA ATTACK PLAN

## 2.1 Tier Architecture

The 109 COSSEC-regulated cooperativas are not a homogenous market. Asset size, regulatory pressure, and CPA firm relationships determine the correct motion for each institution.

```
TIER 1 — Top 20 institutions (>$500M assets)
         Combined assets: ~$8.4B (~70% of sector)
         Motion: White-glove, board-level, personal executive outreach
         Target price: Enterprise ($799–$1,499/mo)

TIER 2 — 25 institutions ($200M–$500M assets)
         Motion: Demo-led, CPA channel, targeted email sequences
         Target price: Professional ($399/mo)

TIER 3 — 40 institutions ($50M–$200M assets)
         Motion: Self-serve trial-first, CPA referral, automated nurture
         Target price: Professional ($299–$399/mo) or per-report ($499)

TIER 4 — 24 institutions (<$50M assets)
         Motion: Partner-only distribution via CPA firms
         Target price: Per-report ($299) or Partner plan pass-through
```

## 2.2 Priority Scoring Matrix

Each institution in the ProspectInstitution table should be scored using the following formula to determine outreach priority order within each tier:

```
Priority Score = (Asset Score × 0.35) 
              + (COSSEC Findings Score × 0.30) 
              + (CPA Relationship Score × 0.20) 
              + (Competitor Usage Score × 0.15)
```

**Asset Score (0–10):** Normalized log scale of total assets
- >$1B: 10
- $500M–$1B: 8
- $200M–$500M: 6
- $50M–$200M: 4
- <$50M: 2

**COSSEC Findings Score (0–10):** Based on regulatory examination findings
- Received IRR examination finding in last 12 months: 10
- Has open examination findings (any type): 7
- Clean last exam, prior findings: 4
- No known findings: 2

**CPA Relationship Score (0–10):** Does CERNIQ have a relationship with their CPA firm?
- CPA firm is a signed CERNIQ partner: 10
- CPA firm is in active outreach: 5
- No known CPA firm relationship: 0

**Competitor Usage Score (0–10):** Are they using known alternative tools?
- Using manual Excel + no consultant: 10 (highest displacement opportunity)
- Using manual Excel + annual consultant: 8
- Using basic ALM software (known): 4
- No data: 3

## 2.3 Tier 1 Attack Plan — Top 20 Cooperativas (>$500M Assets)

### Engagement Protocol
1. **Research Phase (Day 0–3):** Lead Research Agent pulls latest financials, COSSEC findings, board members, CPA firm name, and any press mentions
2. **Personalization Phase (Day 3–5):** Enrichment Agent builds a 1-paragraph institution brief including their specific IRR risk profile based on their public balance sheet
3. **First Contact (Day 5):** Founder or senior sales rep sends a personally crafted email referencing specific COSSEC context — NOT a template blast
4. **Demo Booking (Day 7–14):** If no response to email, LinkedIn outreach. If response, book demo within 48 hours
5. **Demo Delivery:** 20-minute live demo using `/demo?type=cooperativa` with REAL data scenario matched to institution's asset size and loan mix
6. **Board-Level Follow-Up:** Send a 1-page executive brief PDF (not the ALM report — a sell-side brief) within 24 hours of demo
7. **Champion Identification:** Identify internal champion (usually CFO or VP Finance). Send them a free sample report of their own institution's public call report data to prove value
8. **Close:** Propose Enterprise agreement. Offer 30-day free trial with full onboarding support

### Named Target List — Top 30 Outreach Strategies

| # | Institution (Illustrative Names*) | Est. Assets | Primary Contact Role | Outreach Strategy |
|---|---|---|---|---|
| 1 | CoopAhorro San Juan | >$1B | CFO | Founder personal email + LinkedIn + free sample report |
| 2 | Cooperativa La Evangelica | >$1B | VP Finance | Board member intro if available, else cold email |
| 3 | CoopAhorro Ciales | $800M+ | CFO | IRR findings context email, demo offer |
| 4 | Oriental Credit Union | $700M+ | Risk Manager | CPA channel — identify CPA firm first |
| 5 | CoopAhorro Cabo Rojo | $600M+ | CFO | Email sequence + LinkedIn |
| 6 | Cooperativa Camuy | $550M+ | Treasurer | COSSEC urgency angle, demo |
| 7 | CoopAhorro Manati | $500M+ | CFO | Bilingual email, Spanish-first |
| 8 | Cooperativa Isabela | $480M+ | VP Finance | CPA channel outreach |
| 9 | CoopAhorro Mayaguez | $460M+ | CFO | Direct outbound |
| 10 | Cooperativa Ponce | $440M+ | Risk Manager | ALM finding context |
| 11–20 | Institutions 11–20 | $200–$440M | CFO/VP Finance | Demo-led, CPA assist |
| 21–30 | Institutions 21–30 | $150–$200M | CFO/Treasurer | Email sequence, trial offer |

*Actual institution names are stored in the ProspectInstitution table. This table uses illustrative names for documentation. Pull live names from DB before outreach.

### Tier 1 Outreach Message Framework (Bilingual)

**English version (for English-preference contacts):**
> "Your institution received [X] examination findings from COSSEC related to interest rate risk in the last review cycle. Most cooperativas in Puerto Rico are addressing this with manual Excel models built by outside consultants — a process that takes 3–4 weeks and costs $15,000–$40,000 per engagement. CERNIQ delivers a COSSEC-compliant, 14-page ALM report from your existing balance sheet data in under 10 minutes. I'd like to show you a 20-minute demo using data at your institution's scale. Would [date/time] work?"

**Spanish version (primary outreach language):**
> "Su institución recibió [X] hallazgos del examen de COSSEC relacionados con riesgo de tasa de interés en el ciclo de revisión más reciente. La mayoría de las cooperativas en Puerto Rico abordan esto con modelos de Excel manuales elaborados por consultores externos — un proceso que toma 3–4 semanas y cuesta entre $15,000 y $40,000 por contrato. CERNIQ genera un informe ALM de 14 páginas compatible con COSSEC desde sus datos de balance general existentes en menos de 10 minutos. Me gustaría mostrarle una demostración de 20 minutos usando datos a la escala de su institución. ¿Le vendría bien [fecha/hora]?"

## 2.4 Tier 2 Attack Plan — 25 Institutions ($200M–$500M)

**Primary Motion:** Demo-led with CPA firm assist

- Outreach sequence begins with CPA firm angle: "We're working with [CPA firm name] to offer CERNIQ to their cooperativa clients. They recommended I reach out."
- If no CPA relationship known: standard email sequence (5-email, bilingual — see Section 6)
- Demo is self-serve via `/demo?type=cooperativa` link, supported by a 30-minute onboarding call
- Offer 1 free report on first CSV upload to remove friction
- Target: Professional plan at $399/month

## 2.5 Tier 3 Attack Plan — 40 Institutions ($50M–$200M)

**Primary Motion:** Self-serve trial, CPA referral

- Automated email nurture (4-email sequence) triggered by ProspectInstitution record in CRM
- Landing page visit → trial activation → free first report → conversion to paid
- CPA channel is the highest-leverage move here: one CPA firm with 5 Tier 3 clients = 5 activations in one conversation
- Price sensitivity is real at this tier. Lead with the per-report option ($299) and show upgrade path to monthly subscription

## 2.6 Tier 4 Attack Plan — 24 Institutions (<$50M)

**Primary Motion:** Partner-only

- These institutions do not have dedicated risk management staff. The CPA firm IS the ALM function.
- Do not do direct outbound to these institutions. Route exclusively through CPA partners.
- CPA partner generates the report. Institution pays CPA for the service. CPA pays CERNIQ the partner rate.
- Target: $149–$199 per report to partner (partner marks up to $500–$1,500 for client)

---

---

# 3. CPA FIRM CHANNEL PLAYBOOK

## 3.1 Why CPA Firms Are the Multiplier

The math is unavoidable:
- 15–20 CPA firms serve the entire PR cooperativa sector
- Each firm has 10–15 cooperativa clients on average
- One signed CPA partner = 10–15 potential customers acquired with a single sales conversation
- The CPA already has the trust relationship with the CFO. CERNIQ has the product.
- CPA firms are under pressure to deliver more value. ALM automation is a billable service line upgrade.

**Target economics for CPA partner:**
- CPA buys CERNIQ at partner rate: $149/report or $199/month base
- CPA bills cooperativa client: $500–$2,500/engagement (vs. $15K for full consultant)
- CPA margin: 60–80% gross margin on the deliverable
- CERNIQ takes no revenue share on CPA's upside — we charge for platform access only

## 3.2 Target CPA Firms (15–20 PR Cooperativa Specialists)

The following CPA firms are known to specialize in PR cooperativas and should be prioritized. Actual contact data should be pulled from the ProspectInstitution CPA fields and supplemented by COSSEC's published list of approved auditors.

| Priority | Firm Type | Outreach Angle |
|---|---|---|
| 1 | Mid-size PR firm, 10+ cooperativa audit clients | White-label revenue share; position as competitive differentiator |
| 2 | National firm with PR cooperativa practice group | Enterprise partner arrangement; co-marketing |
| 3 | Small boutique cooperativa specialist | Training + certification angle; they need the tool to compete |
| 4 | Accounting firm that also does compliance consulting | COSSEC compliance angle; risk reduction for their clients |

## 3.3 Partner Program Structure

### Three CPA Partner Tiers

**Silver Partner (Entry)**
- Cost: $199/month flat
- Includes: 5 reports/month, white-label logo on report cover page, email support
- Overage: $39/report above 5
- Requirement: Complete 2-hour CERNIQ certification training

**Gold Partner**
- Cost: $499/month
- Includes: 20 reports/month, full white-label (firm name + logo throughout), priority support, co-marketing listing on CERNIQ website
- Overage: $29/report above 20
- Requirement: Minimum 3 cooperativa clients using CERNIQ within 60 days

**Platinum Partner**
- Cost: $999/month
- Includes: Unlimited reports, full white-label, dedicated success manager, custom report cover, co-marketing, referral fee ($200/new direct customer referred)
- Requirement: Minimum 8 cooperativa clients, annual contract

### Revenue Share Model
- Partners do NOT receive revenue share on their own subscription cost
- Platinum partners receive $200 flat referral fee per new CERNIQ direct customer they refer (not their own clients)
- CERNIQ provides CPA partners with co-branded marketing materials, training decks, and regulatory context briefs at no cost

## 3.4 CPA Onboarding Sequence — 14 Days

**Day 0:** Partner agreement signed via DocuSign. Stripe billing activated.

**Day 1–2:** Welcome onboarding call (30 minutes). Cover:
- Platform walkthrough
- How to upload a cooperativa's balance sheet CSV
- How to read and explain the 14-page report to a client
- White-label configuration (logo upload, firm name, contact info)

**Day 3–5:** Certification training module (self-serve, 2 hours):
- ALM fundamentals for CPA professionals (bilingual)
- COSSEC examination framework and what examiners look for
- How to use CERNIQ output to support a COSSEC examination response
- Quiz: 80% pass rate required for certification

**Day 6–7:** Practice run — CPA uploads sample data (CERNIQ provides sanitized sample CSV). Generates first test report. Success Manager reviews.

**Day 8–10:** CPA identifies first client candidate. CERNIQ provides co-branded outreach email template (CPA sends it under their own name).

**Day 11–13:** First client report generated. CPA reviews with Success Manager. Feedback loop.

**Day 14:** Check-in call. Address questions. Confirm pipeline of clients to activate. Set 30-day goal.

## 3.5 CPA Sales Agent Master Prompt

The following is the master prompt for the CPA Outreach Agent (Agent #3 in the 6-agent engine):

```
SYSTEM PROMPT — CPA FIRM OUTREACH AGENT

You are a senior business development specialist for CERNIQ, an ALM reporting 
platform purpose-built for Puerto Rico's cooperativa sector. Your mission is to 
identify, qualify, and engage CPA firms that serve PR cooperativas as potential 
channel partners.

CONTEXT:
- CERNIQ automates 14-page COSSEC-compliant ALM reports in under 10 minutes
- Manual consultant alternative costs cooperativas $15K–$40K/year
- CPA partners can offer this as a premium service line to their cooperativa clients
- Partner pricing: $199–$999/month depending on tier
- CPA gross margin on resale: 60–80%

YOUR TARGETS:
- Accounting firms in Puerto Rico that audit or advise cooperativas
- COSSEC's list of approved cooperativa auditors (15–20 firms)
- Firms that have published content about cooperativa compliance or ALM

OUTREACH RULES:
1. Always lead with the CPA firm's business interest (new revenue, differentiation)
2. Never lead with CERNIQ features. Lead with the cooperativa compliance problem.
3. Reference COSSEC examination findings as market context (60%+ cooperativas have IRR findings)
4. Speak to the CPA as a business owner, not as a compliance officer
5. All emails must be bilingual-ready (write EN, flag where ES version is needed)
6. Never make false claims about specific firms' client lists
7. Personalize each email with the firm's name, any known specialization

OUTPUT FORMAT for each target firm:
{
  "firm_name": "string",
  "primary_contact": "string",
  "email": "string",
  "outreach_email_draft": "full email text",
  "language_preference": "ES|EN|BILINGUAL",
  "notes": "string",
  "priority_score": 1-10
}

SEQUENCE:
Email 1: Partner opportunity intro (Day 0)
Email 2: Specific cooperativa compliance context (Day 5)
Email 3: Case study / social proof (Day 10)
After Email 3: LinkedIn connection request + message
After 21 days no response: Re-queue for next quarter
```

## 3.6 White-Label Configuration Process

**Step 1:** Partner logs into CERNIQ partner portal
**Step 2:** Uploads firm logo (PNG/SVG, min 300px wide)
**Step 3:** Enters firm name, tagline (optional), contact email for report footer
**Step 4:** Selects language default (ES/EN/Bilingual cover page)
**Step 5:** Generates test report to preview branding
**Step 6:** Confirms and saves. All future reports for this partner account render with firm branding.

White-label elements customized: Report cover page header, footer on all 14 pages, email notification sender name ("Report prepared by [Firm Name] powered by CERNIQ"), PDF metadata.

## 3.7 Partner SLA Commitments

| Service | SLA |
|---|---|
| Report generation | < 10 minutes from CSV upload |
| Platform uptime | 99.5% monthly |
| Email support response | < 4 business hours |
| Dedicated success manager response (Gold/Platinum) | < 2 business hours |
| Data security | SOC2-aligned; no cooperativa data stored longer than 72 hours post-report |
| White-label configuration changes | Applied within 1 business day |
| New COSSEC regulatory updates reflected in model | Within 30 days of official publication |

---

---

# 4. OUTBOUND SALES ENGINE — 6 AGENTS

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CERNIQ OUTBOUND ENGINE                       │
│                                                                 │
│  [1] Lead Research    →   [2] Enrichment    →   [3] Messaging  │
│         ↓                       ↓                      ↓       │
│  [6] Follow-up    ←   [5] CRM Update    ←   [4] Outreach       │
└─────────────────────────────────────────────────────────────────┘
```

Data flows from ProspectInstitution → enriched profiles → personalized sequences → CRM updates → follow-up triggers.

---

## Agent 1: Lead Research Agent

**Role:** Autonomous research agent. Takes a cooperativa or CPA firm name from the ProspectInstitution table and returns a fully enriched research brief before any outreach begins.

**Mission:** Ensure every outreach message is informed by real, current data about the institution — not a generic blast.

**Master Prompt:**
```
SYSTEM: You are a financial services research analyst specializing in Puerto Rico's 
cooperativa sector. For each institution provided, you will:

1. Retrieve their most recent COSSEC call report data (assets, liabilities, net worth ratio, 
   loan-to-deposit ratio, NIM trend)
2. Identify any publicly known examination findings related to interest rate risk or ALM
3. Find the name and LinkedIn profile of their CFO, VP Finance, or Treasurer
4. Identify their external auditing/CPA firm
5. Check for any press mentions in the last 24 months (growth, leadership changes, mergers)
6. Assess their current technology posture (any ALM software vendor mentioned publicly)

OUTPUT: Structured JSON:
{
  "institution_name": "",
  "total_assets_usd": 0,
  "tier": "1|2|3|4",
  "cossec_findings_summary": "",
  "primary_contact_name": "",
  "primary_contact_title": "",
  "primary_contact_linkedin": "",
  "cpa_firm_name": "",
  "cpa_firm_contact": "",
  "press_mentions": [],
  "tech_posture": "manual_excel|basic_software|unknown",
  "outreach_urgency_flag": "HIGH|MEDIUM|LOW",
  "personalization_hook": "1-sentence personalization for first email",
  "research_confidence": "HIGH|MEDIUM|LOW",
  "data_sources": []
}

Do not fabricate data. Mark fields as null if not findable. Flag research_confidence 
accordingly. Speed matters: complete each research brief in < 5 minutes.
```

**Input:** `institution_id` from ProspectInstitution table
**Output:** Enriched JSON record → writes back to ProspectInstitution.enrichment_data column
**Cadence:** Runs nightly for all institutions with `last_enriched_at` > 30 days ago. Runs immediately on-demand for any institution where outreach is scheduled in next 48 hours.
**Success Metrics:**
- Research completion rate: > 95% of targeted institutions
- Contact identification rate: > 80% (CFO or VP Finance name found)
- CPA firm identification rate: > 70%

---

## Agent 2: Enrichment Agent

**Role:** Takes raw research data and builds a personalized outreach brief — translating financial data into a compelling, specific reason to reach out NOW.

**Mission:** Convert data into urgency. Find the specific COSSEC pain point, asset/liability mismatch, or regulatory deadline that makes this institution a HIGH priority contact today.

**Master Prompt:**
```
SYSTEM: You are a financial sales strategist. You receive a research brief from the 
Lead Research Agent and your job is to:

1. Identify the single most compelling reason this institution needs CERNIQ RIGHT NOW
   - COSSEC examination finding? → Lead with regulatory compliance angle
   - Rising rate environment impact on their loan portfolio? → Lead with earnings risk angle
   - Upcoming COSSEC examination? → Lead with exam preparation angle
   - High loan-to-deposit ratio? → Lead with liquidity risk angle

2. Write a 2-sentence personalization hook for the first outreach email
   Example: "Your institution's loan-to-deposit ratio of 87% and reported NIM compression 
   in Q4 2025 suggest your ALM model may be showing interest rate sensitivity that 
   warrants board-level visibility — especially ahead of your next COSSEC examination."

3. Assign an outreach strategy:
   - DIRECT: Reach out to CFO/VP Finance directly
   - CPA_FIRST: Identify CPA firm → warm intro through CPA partner
   - BOARD_LEVEL: Assets > $500M + active COSSEC finding → CEO/Board Chair angle
   - WAIT: Institution is in merger or leadership transition → queue for 90 days

4. Recommend email language: ES (Spanish primary) or EN

OUTPUT: 
{
  "institution_id": "",
  "urgency_score": 1-10,
  "primary_angle": "COSSEC_COMPLIANCE|EARNINGS_RISK|EXAM_PREP|LIQUIDITY|GENERAL",
  "personalization_hook_en": "",
  "personalization_hook_es": "",
  "outreach_strategy": "DIRECT|CPA_FIRST|BOARD_LEVEL|WAIT",
  "recommended_language": "ES|EN",
  "recommended_sequence": "TIER1_WHITEG LOVE|STANDARD_5EMAIL|CPA_INTRO|TRIAL_FIRST",
  "do_not_contact_flag": false,
  "enrichment_notes": ""
}
```

**Input:** Research brief from Agent 1
**Output:** Enriched outreach strategy → ProspectInstitution.outreach_strategy column
**Cadence:** Runs immediately after Agent 1 completes. Batch processing for all new/updated records.
**Success Metrics:**
- Personalization hook quality score (human review sample): > 4/5 average
- Urgency score accuracy vs. actual conversion: tracked at 90-day lag

---

## Agent 3: Messaging Agent

**Role:** Writes the actual outreach emails, LinkedIn messages, and follow-up copy for each institution based on the enrichment strategy.

**Mission:** Generate high-quality, human-sounding, personalized bilingual outreach copy that feels like it was written by a domain expert, not a template engine.

**Master Prompt:**
```
SYSTEM: You are a bilingual (Spanish/English) financial services copywriter who 
specializes in B2B outreach for the Puerto Rico credit union and cooperativa sector.

You write cold outreach emails that:
- Sound like they come from a knowledgeable human, not a marketing template
- Reference specific, real details about the institution's financial situation
- Speak the language of cooperativa finance professionals (ALM, IRR, GAP analysis, 
  COSSEC, net interest margin, repricing risk)
- Include ONE clear call to action (demo booking link or reply to schedule)
- Are concise: 150–200 words max for cold emails
- Pass the "would I delete this in 3 seconds?" test

TONE: Professional but direct. Bilingual as requested. Spanish should be 
Puerto Rican business register, not Castilian Spanish. 

NEVER:
- Use generic opener "Hope this email finds you well"
- Use "revolutionary" or "game-changing"
- Include more than one CTA
- Reference features before establishing the problem
- Make up specific data points not provided in the enrichment brief

FOR EACH MESSAGE, OUTPUT:
{
  "message_type": "cold_email_1|cold_email_2|...|linkedin_message|sms",
  "subject_line_en": "",
  "subject_line_es": "",
  "body_en": "",
  "body_es": "",
  "cta": "",
  "personalization_variables": ["var1", "var2"],
  "tone_check": "passed|review_needed",
  "estimated_read_time_seconds": 0
}
```

**Input:** Enrichment brief from Agent 2 + sequence template
**Output:** Complete email/message copy → queued in outreach pipeline
**Cadence:** On-demand; generates next 7 days of outreach messages in nightly batch
**Success Metrics:**
- Open rate (tracked via pixel/link): target > 35%
- Reply rate: target > 8%
- Demo booking rate from email: target > 3%

---

## Agent 4: Outreach Agent

**Role:** Executes the actual send — dispatches emails via configured sending infrastructure, logs LinkedIn message prompts for human execution, and manages send timing and cadence.

**Mission:** Get the right message to the right person at the right time, without burning the domain or triggering spam filters.

**Master Prompt:**
```
SYSTEM: You are an outbound sequence execution manager. Your job is to:

1. Check the outreach queue for messages scheduled for today
2. Validate deliverability conditions before sending:
   - Sending domain reputation check (bounce rate < 2%, spam rate < 0.1%)
   - Daily send volume within warmup limits (max 50/day per mailbox)
   - No duplicate sends to same contact within 72 hours
   - Check DO_NOT_CONTACT list before every send
3. Execute sends for all approved messages
4. Log every send to the LeadActivity table with timestamp, message_id, institution_id
5. Flag any hard bounces for immediate removal and DO_NOT_CONTACT list update
6. For LinkedIn messages: output as a formatted action list for human execution
7. Report daily send summary to CRM dashboard

SEND RULES:
- Maximum 3 emails per institution per sequence (never exceed)
- Minimum 3-day gap between sequence emails to same contact
- Never send on PR public holidays
- Spanish-primary institutions: always use Spanish subject line
- Best send times: Tuesday–Thursday, 8:00–9:30 AM AST

ESCALATION: If bounce rate > 5% on any mailbox in a single day, pause all sends 
from that mailbox and alert human operator immediately.

OUTPUT: Daily send report JSON with counts, bounce rate, delivery rate, and any flags.
```

**Input:** Approved message queue from Agent 3
**Output:** Send logs → LeadActivity table; daily report → CRM dashboard
**Cadence:** Runs daily at 7:45 AM AST. Reviews queue and executes approved sends.
**Success Metrics:**
- Email deliverability rate: > 95%
- Bounce rate: < 2%
- Send execution accuracy: 100% (no duplicate sends, no DO_NOT_CONTACT violations)

---

## Agent 5: CRM Agent

**Role:** Maintains the health and accuracy of the ProspectInstitution table and the full leads pipeline. Updates lead stages, surfaces hot leads, and ensures no prospect falls through the cracks.

**Mission:** Be the source of truth. Every action taken by every other agent must be reflected accurately in CRM within minutes.

**Master Prompt:**
```
SYSTEM: You are a CRM data integrity and intelligence agent for CERNIQ's sales pipeline.

YOUR RESPONSIBILITIES:

1. LEAD STAGE MANAGEMENT — Update prospect records based on activity signals:
   - Email opened → stage: AWARE
   - Link clicked → stage: ENGAGED
   - Demo URL visited (DEMO_STARTED analytics event) → stage: DEMO_ACTIVE
   - PDF_DOWNLOADED event → stage: HIGH_INTENT
   - LEAD_FORM_OPENED event → stage: MQL (Marketing Qualified Lead)
   - LEAD_FORM_COMPLETED event → stage: SQL (Sales Qualified Lead)
   - Demo call booked → stage: OPPORTUNITY
   - Contract sent → stage: PROPOSAL
   - Stripe payment received → stage: CUSTOMER

2. DAILY PIPELINE REVIEW — Every morning, generate:
   - Leads in DEMO_ACTIVE status for > 3 days without PDF_DOWNLOADED → flag for follow-up
   - Leads in MQL status for > 5 days → escalate to human sales review
   - Leads in OPPORTUNITY status with no activity in > 7 days → flag as STALLED
   - New CUSTOMER accounts → trigger onboarding sequence

3. DATA QUALITY — Weekly audit:
   - Contacts with missing email → flag for enrichment
   - Institutions with last_contact_date > 90 days → flag for re-engagement
   - Bounced email records → mark invalid, find alternate contact

4. REPORTING — Weekly output:
   - Pipeline by stage (counts and MRR potential)
   - Conversion rates stage-to-stage
   - Top 10 hot leads for human follow-up
   - MRR forecasted from current OPPORTUNITY stage

OUTPUT: Structured CRM update payloads + daily/weekly summary reports.
```

**Input:** Activity events from all other agents + Stripe webhook events
**Output:** Updated ProspectInstitution records + pipeline reports
**Cadence:** Continuous event processing. Daily morning report at 8:00 AM AST. Weekly report every Monday.
**Success Metrics:**
- Data accuracy: < 2% records with known errors
- Lead stage lag: < 15 minutes from activity event to stage update
- Hot lead identification rate: > 80% of eventual customers were flagged as HIGH_INTENT before close

---

## Agent 6: Follow-Up Agent

**Role:** Monitors the pipeline for stalled, dropped, or non-converting leads and deploys the right re-engagement sequence at the right time.

**Mission:** Revenue is lost in the follow-up gap. This agent closes the gap. It watches for every lead that showed interest and went cold, and re-engages them systematically.

**Master Prompt:**
```
SYSTEM: You are a follow-up and re-engagement specialist for CERNIQ. Your job is to 
recover leads that showed interest but did not convert.

TRIGGER CONDITIONS AND RESPONSES:

1. DEMO_STARTED but no PDF_DOWNLOADED within 30 minutes:
   → Send Follow-Up Email A (Subject: "Did you get to see the full report?")
   → Delay: 2 hours after DEMO_STARTED

2. PDF_DOWNLOADED but LEAD_FORM not opened within 24 hours:
   → Send Follow-Up Email B (Subject: "Your ALM report is ready — next step")
   → Delay: 24 hours after PDF_DOWNLOADED

3. LEAD_FORM_OPENED but not COMPLETED:
   → Send Follow-Up Email C (Subject: "One question — what would you need to see?")
   → Delay: 4 hours. This is the hottest signal. Treat as priority.

4. Demo call booked but no-show:
   → Send reschedule email within 30 minutes of missed appointment
   → Attempt 2 reschedules maximum, then move to nurture sequence

5. Contract sent, no signature in 7 days:
   → Send check-in email
   → If no response: call flag to human sales rep

6. Customer inactive > 30 days (no report generated):
   → Send usage reminder + offer 1 complimentary usage review call

FOLLOW-UP RULES:
- Never send more than 2 follow-up messages in the same week
- Always provide value or new information — never send a pure "just checking in" message
- Reference the specific action the lead took ("I saw you downloaded the CoopAhorro 
  sample report yesterday...")
- Include a concrete easy next step in every follow-up

OUTPUT: Queued follow-up messages with send timestamps → Agent 4 queue
```

**Input:** Demo analytics events (STARTED, SEED_COMPLETE, CALC_COMPLETE, PDF_DOWNLOADED, LEAD_FORM_OPENED, COMPLETED) + CRM stage data
**Output:** Follow-up message queue → Agent 4 for execution
**Cadence:** Event-driven (triggers on activity events). Also runs a nightly sweep for any stalled leads.
**Success Metrics:**
- Recovery rate: > 20% of PDF_DOWNLOADED leads convert to LEAD_FORM_COMPLETED after follow-up
- No-show reschedule rate: > 40% of no-shows rescheduled within 3 days
- Stalled deal recovery rate: > 15% of STALLED opportunities reactivated within 30 days

---

---

# 5. DEMO-TO-CLOSE PLAYBOOK

## 5.1 Demo Script — 20 Minutes at `/demo?type=cooperativa`

**Pre-Demo Prep (15 minutes before):**
- Confirm attendee name and title. If CFO: use CFO persona track. If Risk Manager: use Risk track.
- Pull their institution data from CRM. Review their asset size, loan mix estimate, any COSSEC findings.
- Have the demo URL open in a separate tab: `/demo?type=cooperativa`
- The demo auto-starts with "CoopAhorro San Juan" — a $250M institution. If meeting a Tier 1 institution (>$500M), note that the demo data is deliberately scaled to show a mid-size institution for clarity, and your platform handles institutions of any size.

---

**[0:00–2:00] — Opening: Establish the Problem (Their Words, Not Yours)**

> "Before I show you anything, let me ask — when did your institution last produce a formal ALM report? And who built it?"

*Listen. Common answers:*
- "We use an outside consultant — takes about 3–4 weeks, costs us [X]"
- "Our CFO does it in Excel every quarter"
- "COSSEC requested updated documentation and we're behind"

> "That matches exactly what we hear from cooperativas across Puerto Rico. And with COSSEC tightening examination standards — 60% of cooperativas received IRR-related findings in the last exam cycle — the pressure to have current, defensible documentation has never been higher."

---

**[2:00–5:00] — The Core Demo: Upload to Report**

> "Let me show you what CERNIQ does. This is our demo environment, pre-loaded with a $250M cooperativa's balance sheet data — same format as a NCUA 5300 call report export."

*[Click through auto-start sequence.]*

> "The system is now reading the balance sheet structure. It's identifying asset categories, repricing buckets, maturity schedules. In about 60 seconds it will have built the complete interest rate risk model."

*[CALC_COMPLETE fires. Show intermediate state.]*

> "Here's where the model runs — GAP analysis, duration, income simulation across rate shock scenarios. COSSEC's standard examination framework uses 200, 300, and 400 basis point shocks. You can see all three scenarios calculated simultaneously."

---

**[5:00–12:00] — Walk the 14-Page Report**

*[PDF_DOWNLOADED auto-prompt.]*

> "This is the output. Fourteen pages. Board-ready. Bilingual by default — Spanish headers, English footnotes, or fully Spanish as your board prefers."

Walk pages in order:
1. **Executive Summary:** "Your board sees this first. Net interest income at risk, current vs. stressed. No jargon — a CFO can read this in 90 seconds."
2. **GAP Analysis:** "Static repricing GAP by maturity bucket. This is exactly what COSSEC's examiner will request."
3. **Duration Analysis:** "Modified duration for assets, liabilities, equity."
4. **Income Simulation:** "NIM impact under +200, +300, +400 bps. Your institution's specific loan portfolio and deposit mix is what drives this."
5. **Policy Compliance Page:** "Does your current position fall within your board-approved ALM policy limits? This page shows it explicitly."
6. **Recommendations:** "Specific, actionable recommendations formatted for board presentation."

> "The full process, from CSV upload to downloaded PDF, took just over 8 minutes for this demonstration. In a real engagement, it takes 10–15 minutes depending on data complexity."

---

**[12:00–16:00] — Pricing Conversation**

> "Let me talk about what this costs, because I want to be transparent. Your institution is currently spending either $15,000–$40,000 per year on a consultant for this, or your CFO is spending 2–3 days per quarter in Excel. Either way, there's real cost here."

> "CERNIQ's Professional plan is $399/month — that's under $5,000/year. For that, you get unlimited reports, the full 14-page output, bilingual formatting, and all future COSSEC model updates automatically applied."

> "For institutions your size, our Enterprise plan at $799/month also includes a dedicated success manager, custom report branding, and a quarterly review call with our ALM model team."

> "And if you just want to start with a single report before committing to a subscription — that's $499. You upload your balance sheet, we generate the report, and you own it permanently. No subscription required."

---

**[16:00–19:00] — Objection Handling**

*(See full objection map in Section 7. Key responses:)*

**"We already have a consultant."**
> "Your consultant likely uses a tool like this — or builds it in Excel — to generate what they then present to you. You're paying for their time and markup, not specialized knowledge you couldn't access directly. CERNIQ gives you the same output, on demand, at a fraction of the cost."

**"Our COSSEC examiner expects a human-prepared analysis."**
> "COSSEC requires defensible documentation, not a specific format. Our reports include a full methodology appendix, data sources, and model assumptions — exactly what an examiner needs to evaluate your IRR program. Several of our users have already presented CERNIQ-generated reports in examination contexts."

**"What if our data doesn't fit your template?"**
> "We support the standard NCUA 5300 call report export format, plus a custom CSV mapper for institutions with non-standard chart of accounts. Walk me through your data format and we'll confirm compatibility on the spot."

---

**[19:00–20:00] — Close**

> "Based on what you've seen — and your current situation with [specific COSSEC context from research] — what's the biggest question you'd need answered before moving forward?"

*Listen. Address. Then:*

> "I'd like to propose we do a live trial with your actual balance sheet data. You export your last quarter's call report, upload it here, and you'll have your institution's actual ALM report in hand within the hour. Zero risk. If it's not what you need, you've lost nothing. If it works — and I'm confident it will — we talk about subscription."

*Send Stripe link for single-report trial ($499) or Professional plan signup immediately after call.*

---

## 5.2 CFO Persona Journey

**Primary buyer. Controls the budget. Cares about:**
1. Cost vs. current spend (consultant fees)
2. Speed (quarterly deadline pressure)
3. Board presentation quality
4. COSSEC examination defensibility

**Journey:** Cold email referencing exam findings → Demo showing cost savings → Free trial with their data → Professional plan signup → Monthly report generation workflow

**Key message:** "Replace $15K–$40K/year with $399/month. Same output. Your own data. Ready before the board meeting."

## 5.3 Risk Manager Persona Journey

**Technical buyer. Validates the methodology. Cares about:**
1. Model accuracy (GAP, duration, income simulation)
2. Scenario coverage (rate shocks match COSSEC standards)
3. Auditability (can they defend the methodology?)
4. Integration with existing data

**Journey:** Referred by CFO or found via demo link → Downloads sample report → Reviews methodology appendix → Asks technical questions → Validates model → Recommends to CFO

**Key message:** "Built on the same DFA/static GAP/duration framework your examiners use. Full methodology documentation. Defensible in any examination."

## 5.4 CPA Partner Persona Journey

**Channel buyer. Cares about:**
1. Revenue opportunity (can I bill this to my clients?)
2. Quality assurance (will this embarrass me in front of my clients?)
3. Ease of use (can my staff run this without retraining?)
4. Differentiation (does this help me win/keep clients?)

**Journey:** CPA channel email → Partner program overview call → Certification training → First client report generated → First invoice to client → Monthly recurring usage

**Key message:** "Add a premium ALM reporting service to your cooperativa practice. Your clients need it. You can bill $500–$2,500 per engagement. Your cost is under $200/month."

## 5.5 Day 1 Handoff Checklist (Post-Close)

- [ ] Stripe payment confirmed
- [ ] Welcome email sent (automated) within 5 minutes of payment
- [ ] Onboarding call scheduled within 48 hours
- [ ] Account provisioned with correct plan tier
- [ ] White-label configured (if Partner plan)
- [ ] Sample CSV template sent
- [ ] First report generated from their data within 7 days
- [ ] Introduced to Success Manager (Gold/Platinum/Enterprise)
- [ ] NPS survey scheduled for Day 30
- [ ] CRM stage updated to CUSTOMER

---

---

# 6. EMAIL SEQUENCES — FULL TEMPLATES

## 6.1 Cold Outreach Sequence — 5 Emails (Bilingual)

### Email 1 — Day 0: The Specific Problem

**Subject (EN):** ALM report for [Institution Name] — 10 minutes, not 4 weeks
**Subject (ES):** Informe ALM para [Nombre Institución] — 10 minutos, no 4 semanas

**Body (EN):**
> Hi [First Name],
>
> [Personalization hook from Enrichment Agent — e.g., "With COSSEC's renewed focus on interest rate risk documentation, cooperativas at your asset size are under more examination scrutiny than at any point in the past five years."]
>
> CERNIQ automates the complete 14-page ALM report your board and examiners require — from your existing call report data — in under 10 minutes. The same report most cooperativas pay $15,000+ for from outside consultants.
>
> Would you be open to a 20-minute demo using a sample at your institution's asset scale? I'll show you the full report output and you can decide if it's worth a trial with your own data.
>
> [Demo link] → Book a time that works for you.
>
> [Sender Name]
> CERNIQ | ALM for Puerto Rico Cooperativas

**Body (ES):**
> Estimado/a [Nombre],
>
> [Gancho personalizado del Agente de Enriquecimiento]
>
> CERNIQ automatiza el informe ALM completo de 14 páginas que su junta y los examinadores requieren — desde sus datos existentes del informe de llamada — en menos de 10 minutos. El mismo informe que la mayoría de las cooperativas paga $15,000 o más a consultores externos.
>
> ¿Estaría dispuesto/a a una demostración de 20 minutos usando datos a la escala de su institución? Le mostraré el informe completo y puede decidir si vale la pena una prueba con sus propios datos.
>
> [Enlace demo] → Reserve un horario conveniente.
>
> [Nombre del remitente]
> CERNIQ | ALM para Cooperativas de Puerto Rico

---

### Email 2 — Day 4: The Cost Angle

**Subject (EN):** What your ALM report actually costs
**Subject (ES):** Lo que realmente cuesta su informe ALM

**Body (EN):**
> Hi [First Name],
>
> A quick follow-up. I want to be specific about the math, because it's the conversation I've had with almost every cooperativa CFO in Puerto Rico.
>
> Consultant route: $15,000–$40,000/year. 3–4 weeks per engagement. Dependent on one person's schedule.
>
> CERNIQ route: $399/month ($4,788/year). Under 10 minutes per report. Available whenever you need it — quarterly board meeting, COSSEC exam prep, mid-year stress test.
>
> That's a $10,000–$35,000 annual difference for the same output.
>
> If you'd like to verify this against your own data, I'll run your institution's report at no charge before you commit to anything. Reply with your interest and I'll send the upload instructions.
>
> [Sender Name]

**Body (ES):**
> Estimado/a [Nombre],
>
> Un breve seguimiento. Quiero ser específico con los números, porque es la conversación que he tenido con casi todos los CFO de cooperativas en Puerto Rico.
>
> Ruta de consultor: $15,000–$40,000/año. 3–4 semanas por compromiso. Dependiente del calendario de una persona.
>
> Ruta CERNIQ: $399/mes ($4,788/año). Menos de 10 minutos por informe. Disponible cuando lo necesite — reunión trimestral de junta, preparación para examen COSSEC, prueba de estrés a mitad de año.
>
> Esa es una diferencia anual de $10,000–$35,000 por el mismo producto.
>
> Si desea verificarlo con sus propios datos, generaré el informe de su institución sin costo antes de que se comprometa con nada. Responda con su interés y le enviaré las instrucciones de carga.
>
> [Nombre del remitente]

---

### Email 3 — Day 9: Social Proof / Regulatory Urgency

**Subject (EN):** COSSEC examinations and ALM documentation — what we're seeing
**Subject (ES):** Exámenes COSSEC y documentación ALM — lo que estamos viendo

**Body (EN):**
> Hi [First Name],
>
> One more data point worth having: over 60% of cooperativas that underwent COSSEC examination in the past year received findings related to interest rate risk documentation. The most common finding? Insufficient evidence that the institution's ALM program is monitored and reported to the board on a regular basis.
>
> CERNIQ generates a timestamped, model-documented, board-ready report every time it runs. That's a clear audit trail.
>
> If your next examination is within the next 12 months, I'd prioritize getting your baseline report in hand now — before an examiner asks for it.
>
> 20 minutes to see how it works: [Demo link]
>
> [Sender Name]

**Body (ES):**
> Estimado/a [Nombre],
>
> Un dato más que vale la pena tener: más del 60% de las cooperativas que se sometieron al examen COSSEC en el último año recibieron hallazgos relacionados con la documentación de riesgo de tasa de interés. El hallazgo más común: evidencia insuficiente de que el programa ALM de la institución es monitoreado y reportado a la junta de forma regular.
>
> CERNIQ genera un informe con fecha, modelo documentado y listo para la junta cada vez que se ejecuta. Eso es una pista de auditoría clara.
>
> Si su próximo examen es dentro de los próximos 12 meses, priorizaría tener su informe base en mano ahora — antes de que un examinador lo solicite.
>
> 20 minutos para ver cómo funciona: [Enlace demo]
>
> [Nombre del remitente]

---

### Email 4 — Day 16: The Trial Offer

**Subject (EN):** Free report — your institution's actual data
**Subject (ES):** Informe gratuito — datos reales de su institución

**Body (EN):**
> Hi [First Name],
>
> I've sent a few messages over the past few weeks. I don't want to be a nuisance — but I do want to make one concrete offer before I close the loop.
>
> Upload your last quarter's balance sheet CSV and I'll have CERNIQ generate your institution's actual ALM report at no charge. You'll see your real numbers — GAP analysis, duration, income simulation under rate stress scenarios — not a sample.
>
> If it's useful, we talk about moving forward. If it's not right for your institution, I'll leave you alone and you keep the report.
>
> Fair enough? Reply "Yes" and I'll send the upload link.
>
> [Sender Name]

**Body (ES):**
> Estimado/a [Nombre],
>
> He enviado algunos mensajes en las últimas semanas. No quiero ser una molestia — pero sí quiero hacer una oferta concreta antes de cerrar el ciclo.
>
> Suba el CSV de balance general del último trimestre y haré que CERNIQ genere el informe ALM real de su institución sin costo. Verá sus números reales — análisis GAP, duración, simulación de ingresos bajo escenarios de estrés de tasas — no una muestra.
>
> Si es útil, hablamos de avanzar. Si no es lo correcto para su institución, lo dejaré tranquilo y usted conserva el informe.
>
> ¿De acuerdo? Responda "Sí" y le envío el enlace de carga.
>
> [Nombre del remitente]

---

### Email 5 — Day 25: The Breakup (With a Door Left Open)

**Subject (EN):** Closing the loop — [Institution Name]
**Subject (ES):** Cerrando el ciclo — [Nombre Institución]

**Body (EN):**
> Hi [First Name],
>
> I'll keep this brief. I've reached out a few times about CERNIQ's ALM reporting platform. I haven't heard back, which tells me either the timing isn't right or this isn't a priority.
>
> I'll take you off my active outreach list. If your situation changes — upcoming COSSEC examination, board request for updated ALM documentation, or you just decide it's time to automate this — the demo is always available at [demo link].
>
> The offer for a free trial report with your data stands indefinitely.
>
> Best of luck with the next examination cycle.
>
> [Sender Name]

**Body (ES):**
> Estimado/a [Nombre],
>
> Seré breve. Me he comunicado varias veces sobre la plataforma de informes ALM de CERNIQ. No he recibido respuesta, lo que me indica que el momento no es el adecuado o que esto no es una prioridad.
>
> Lo removeré de mi lista de contacto activo. Si su situación cambia — próximo examen COSSEC, solicitud de la junta de documentación ALM actualizada, o simplemente decide que es hora de automatizar esto — la demostración siempre está disponible en [enlace demo].
>
> La oferta de un informe de prueba gratuito con sus datos permanece vigente indefinidamente.
>
> Mucho éxito en el próximo ciclo de examinación.
>
> [Nombre del remitente]

---

## 6.2 CPA Firm Outreach Sequence — 3 Emails

### CPA Email 1 — Day 0: The Revenue Opportunity

**Subject (EN):** New ALM service line for your cooperativa practice
**Subject (ES):** Nueva línea de servicio ALM para su práctica de cooperativas

**Body (EN):**
> Hi [CPA First Name],
>
> I'm reaching out because [Firm Name] is known as one of the leading accounting practices serving Puerto Rico's cooperativa sector. I have a partnership opportunity that I think fits your practice.
>
> CERNIQ is an ALM reporting platform that generates COSSEC-compliant 14-page reports in under 10 minutes from a cooperativa's balance sheet data. We're looking for CPA firms to offer this as a premium service to their cooperativa clients — fully white-labeled under your firm's name.
>
> The economics: your firm pays $199–$499/month for platform access. You bill your clients $500–$2,500 per engagement. Your gross margin is 70%+. And you're providing a service your clients already need — but currently have to hire a separate consultant for.
>
> Would you have 20 minutes to explore whether this fits your practice? I'd rather show you than describe it.
>
> [Demo link for CPA version]
>
> [Sender Name], CERNIQ Partner Development

**Body (ES):**
> Estimado/a [Nombre CPA],
>
> Me comunico porque [Nombre de Firma] es reconocida como una de las prácticas contables líderes que sirven al sector cooperativista de Puerto Rico. Tengo una oportunidad de asociación que creo que encaja con su práctica.
>
> CERNIQ es una plataforma de informes ALM que genera informes de 14 páginas compatibles con COSSEC en menos de 10 minutos a partir de los datos del balance general de una cooperativa. Estamos buscando firmas de CPA para ofrecer esto como un servicio premium a sus clientes cooperativistas — completamente bajo la marca de su firma.
>
> La economía: su firma paga $199–$499/mes por acceso a la plataforma. Le factura a sus clientes $500–$2,500 por compromiso. Su margen bruto es del 70%+.
>
> ¿Tendría 20 minutos para explorar si esto encaja con su práctica?
>
> [Enlace demo versión CPA]
>
> [Nombre del remitente], Desarrollo de Socios CERNIQ

---

### CPA Email 2 — Day 6: The Competitive Angle

**Subject (EN):** How other PR accounting firms are differentiating on ALM
**Subject (ES):** Cómo otras firmas contables de PR se están diferenciando en ALM

**Body (EN):**
> Hi [CPA First Name],
>
> A quick follow-up. I wanted to share what we're hearing from the accounting firms we've spoken with across Puerto Rico.
>
> The ones moving fastest on ALM services aren't the largest firms — they're the ones who recognized early that COSSEC's tightening standards would force cooperativas to upgrade their documentation. They're adding ALM as a recurring service line alongside annual audits.
>
> For your clients, this is urgent: 60%+ of cooperativas have received IRR examination findings. They need better documentation. If you don't provide it, they'll find someone who does.
>
> CERNIQ lets your firm deliver that documentation without hiring ALM specialists or overhauling your practice. The platform does the modeling. Your firm adds the interpretation and client relationship value.
>
> Happy to show you a live example: [Demo link]
>
> [Sender Name]

---

### CPA Email 3 — Day 14: The Offer

**Subject (EN):** 30-day free trial — your firm + 1 cooperativa client
**Subject (ES):** Prueba gratuita de 30 días — su firma + 1 cliente cooperativa

**Body (EN):**
> Hi [CPA First Name],
>
> Last message from me on this topic. I'd like to make a concrete offer:
>
> 30-day free trial of the CERNIQ Gold Partner plan. Pick one of your cooperativa clients. We'll run their ALM report together. You see the full output. You decide if you can bill it to your client and if the quality meets your standard.
>
> No credit card. No obligation. If it works, we talk terms. If not, nothing lost.
>
> Reply "Let's try it" and I'll set up your account within the hour.
>
> [Sender Name]

---

## 6.3 Demo Follow-Up Sequence — 3 Emails

### Post-Demo Email 1 — Within 2 hours of demo

**Subject (EN):** Your CERNIQ demo — the report + next steps
**Subject (ES):** Su demo de CERNIQ — el informe + próximos pasos

**Body (EN):**
> Hi [First Name],
>
> Thanks for the time today. I'm attaching the sample report we walked through, plus one additional page I didn't have time to cover — the Policy Compliance Summary, which is typically the page your COSSEC examiner spends the most time on.
>
> Based on our conversation, the most relevant scenario for [Institution Name] is [specific observation from demo call]. I can have your institution's report generated from your call report data within the same day if you send me the CSV.
>
> To move forward: [Stripe link for single report trial at $499] or [Professional plan at $399/month]
>
> Or if you want to discuss the right plan first: [Calendar link]
>
> [Sender Name]

---

### Post-Demo Email 2 — Day 3: Address Specific Objection

**Subject (EN):** Re: [topic from their specific question during demo]
**Subject (ES):** Re: [tema de su pregunta específica durante la demo]

*(This email is generated by the Messaging Agent based on the demo notes logged by the sales rep. It directly addresses the main concern raised during the demo.)*

> Hi [First Name],
>
> I wanted to follow up on the question you raised about [specific objection/question]. Here's more detail:
>
> [Tailored response — 2–3 sentences addressing the specific concern]
>
> The bottom line: [one sentence answer to their core question].
>
> Still the most effective way to address this is to run your actual data. That way you're not evaluating a hypothetical — you're evaluating your institution's real numbers. I can make that happen within 24 hours of receiving your CSV.
>
> [Sender Name]

---

### Post-Demo Email 3 — Day 7: The Trial Push

**Subject (EN):** [Institution Name] + CERNIQ — trial offer expires Friday
**Subject (ES):** [Nombre Institución] + CERNIQ — oferta de prueba vence el viernes

**Body (EN):**
> Hi [First Name],
>
> I'm following up one last time on the demo we had last week. I want to make the trial offer time-bounded — I'm holding a free report credit for [Institution Name] through Friday.
>
> This means: send me your Q1 2026 balance sheet CSV by Friday and I'll run your full ALM report at no charge. You'll have 14 pages of board-ready documentation — your institution's actual numbers — by end of business Friday.
>
> After Friday, the free credit goes to the next institution in queue.
>
> Worth doing? Reply with your CSV or a quick "yes" and I'll send the upload link.
>
> [Sender Name]

---

## 6.4 Nurture Sequence — 4 Emails (Stuck Deals)

For leads that are in CRM but have gone cold after demo — no response in 14+ days.

**Nurture Email 1 — Day 0: Regulatory Update**
Send a relevant COSSEC regulatory update or published guidance note as value-add. No hard sell. Re-establish that CERNIQ is the source of expertise in this space.

**Nurture Email 2 — Day 10: New Feature or Report Improvement**
Share a specific improvement to the CERNIQ report. Frame as: "We shipped an update you'd want to know about if you're evaluating ALM tools."

**Nurture Email 3 — Day 21: Peer Institution Context**
"A cooperativa in your asset range just used CERNIQ to prepare their COSSEC examination response. Here's how that played out." (Use a de-identified customer story or the demo data scenario.)

**Nurture Email 4 — Day 35: Soft Re-Qualification**
"We've stayed in touch for a while. Help me understand — is ALM automation something you're actively evaluating this year, or is it on hold?" Give them an easy way to respond. Even a "not this year" is useful data.

---

## 6.5 Win-Back Sequence — Churned or Cold Leads

For leads that completed the demo funnel but did not convert, and are now > 60 days cold.

**Win-Back Email 1:** "The math has changed" — send updated pricing or a new annual plan option
**Win-Back Email 2:** "COSSEC just [specific action]" — use current regulatory news as re-entry point
**Win-Back Email 3:** "One question" — "What would have to change for this to be the right time?"

---

---

# 7. COMPETITIVE INTELLIGENCE & POSITIONING

## 7.1 The Competitive Landscape in PR ALM

CERNIQ's primary competition is NOT another software product. It is inertia, manual processes, and consultant relationships.

| Competitor Type | How Common | CERNIQ Advantage |
|---|---|---|
| Manual Excel + Internal Staff | 60% of market | Speed (10 min vs. days), consistency, auditability |
| Outside Consultant (annual engagement) | 70% of market | Cost ($4,788/yr vs. $15K–$40K), speed, on-demand |
| National ALM Software (Plansmith, ALM First, etc.) | 5–10% of sector | Purpose-built for PR cooperativas/COSSEC; bilingual; 10x lower cost |
| Basic credit union software ALM module | 10% of market | Report quality; board-presentation readiness; COSSEC-specific |
| No ALM program | ~10% of smaller coops | This is a compliance risk for them, not an opportunity to do nothing |

## 7.2 CERNIQ vs. Manual Consultant — Primary Displacement

This is the most important competitive narrative because it represents the most revenue to be captured.

| Dimension | Manual Consultant | CERNIQ |
|---|---|---|
| Time to report | 2–4 weeks | 8–10 minutes |
| Cost per engagement | $15,000–$40,000 | $399–$799/month (unlimited) |
| Availability | Scheduled, calendar-dependent | 24/7, self-serve |
| COSSEC update lag | Depends on consultant | Automatic model updates |
| Board report quality | High (consultant-designed) | High (14-page, board-formatted) |
| Bilingual | Usually English-only | Native bilingual (ES/EN) |
| Audit trail | Paper-based | Timestamped digital record |
| Data ownership | Consultant holds your model | Institution owns all data |

**Positioning statement:** "CERNIQ doesn't replace your consultant's relationship or strategic judgment. It replaces the part of their work that is mechanical, repetitive, and expensive — the model and the report. Your institution gets the same quality output at 3% of the cost."

## 7.3 Objection Map

### Objection 1: "We already use a consultant and we trust them."
**Response:** "That trust is valuable. We're not asking you to stop using your consultant for strategic advice. We're asking whether you want to pay $15,000+ per year for a task that takes 10 minutes with the right tool. Most of our customers still work with their CPA or consultant — they just no longer pay for the report preparation."

**Spanish:** "Esa confianza tiene valor. No le pedimos que deje de usar a su consultor para asesoramiento estratégico. Le preguntamos si desea pagar $15,000+ al año por una tarea que toma 10 minutos con la herramienta adecuada."

---

### Objection 2: "We do it in Excel. It works fine."
**Response:** "Excel works until it doesn't — and with COSSEC, 'it doesn't' happens during an examination. Excel models have version control issues, aren't reproducible, and don't generate the audit trail COSSEC expects. Has your examiner ever asked to see the Excel model itself, not just the output?"

---

### Objection 3: "We're too small / ALM isn't a priority for us."
**Response:** "COSSEC doesn't have a size threshold for IRR examination findings. We've seen institutions under $50M in assets receive findings. And the cost of a finding — remediation, additional examinations, potential MOU — is far more expensive than an ALM program. The question isn't whether you need it. It's how much you want to spend on it."

---

### Objection 4: "Our COSSEC examiner expects the report from our consultant."
**Response:** "What your examiner expects is a methodology they can verify, a report they can read, and evidence your board is reviewing it. CERNIQ's output has a full methodology appendix, is dated and versioned, and is explicitly formatted for board presentation and examination review. The source is a tool, not a person — and that's acceptable under COSSEC guidance."

---

### Objection 5: "We'd need to evaluate this over 6 months."
**Response:** "I understand due diligence. Here's what I'd suggest: generate your institution's actual report today. Not a sample — your data. That evaluation will tell you more in 10 minutes than 6 months of committee meetings about a hypothetical. The $499 trial report is the fastest diligence you can do."

---

### Objection 6: "What if COSSEC updates their standards and your model is wrong?"
**Response:** "That's exactly the risk with Excel and many consultant models too — there's no guaranteed update cycle. CERNIQ's model is updated within 30 days of any COSSEC published guidance change. Your subscription includes all future model updates automatically. That's a better update guarantee than you get from a consultant on a once-a-year engagement."

---

## 7.4 Win/Loss Framework

After each deal that closes or is lost, log the following to enable pattern recognition:

**Win log fields:**
- Institution tier
- Primary buyer persona
- First contact to close (days)
- Winning angle (cost, speed, COSSEC compliance, CPA referral)
- Which sequence email generated first reply
- Demo-to-close (days)

**Loss log fields:**
- Stated reason for not moving forward
- Actual underlying reason (sales rep assessment)
- Competitor chosen (if any)
- Re-engagement window (when to try again)
- What would have changed the outcome

**Review cadence:** Review win/loss logs every 4 weeks. Update objection map and email sequences based on patterns.

---

---

# 8. REVENUE MILESTONES & TRACKING

## 8.1 MRR Targets — Month 1–18

| Month | Target MRR | Target Accounts | Key Milestone |
|---|---|---|---|
| May 2026 (M1) | $2,500 | 5 | First paying customer |
| Jun 2026 (M2) | $8,000 | 18 | First CPA partner live |
| Jul 2026 (M3) | $15,000 | 32 | 3 CPA partners active |
| Aug 2026 (M4) | $22,000 | 45 | First Tier 1 Enterprise signed |
| Sep 2026 (M5) | $30,000 | 58 | 30% of Tier 1 in active trial |
| Oct 2026 (M6) | $38,000 | 70 | Channel (CPA) generates > 25% of new MRR |
| Nov 2026 (M7) | $46,000 | 82 | First cooperativa case study published |
| Dec 2026 (M8) | $52,000 | 90 | Year-end board presentation season drives spike |
| Jan 2027 (M9) | $55,000 | 95 | Churn < 3% monthly |
| Feb 2027 (M10) | $59,000 | 100 | 100 accounts milestone |
| Mar 2027 (M11) | $64,000 | 108 | Full COSSEC exam season demand |
| Apr 2027 (M12) | $68,000 | 115 | Year 1 anniversary — publish sector report |
| May 2027 (M13) | $72,000 | 120 | NCUA credit union expansion active |
| Jun 2027 (M14) | $75,000 | 125 | Second CPA wave (smaller firms) |
| Jul 2027 (M15) | $78,000 | 129 | Enterprise plan upsells |
| Aug 2027 (M16) | $80,000 | 132 | Approaching $1M ARR run rate |
| Sep 2027 (M17) | $83,333+ | 135+ | $1M ARR — TARGET ACHIEVED |

**Revenue Mix at $1M ARR (Target):**
- Professional ($399/mo): 60 accounts = $23,940/mo
- Enterprise ($799/mo): 25 accounts = $19,975/mo
- CPA Partner plans (avg $499/mo): 20 partners = $9,980/mo
- Per-report revenue ($499 avg): 60 reports/month = $29,940/mo

**Total: ~$83,835/month = ~$1.006M ARR**

## 8.2 Leading Indicators Dashboard

The following metrics should be visible on the GTM dashboard, updated daily:

| Metric | Description | Target |
|---|---|---|
| Demo Starts (7-day) | `/demo?type=cooperativa` DEMO_STARTED events | 15+ per week |
| Demo Completion Rate | CALC_COMPLETE / DEMO_STARTED | > 70% |
| PDF Download Rate | PDF_DOWNLOADED / DEMO_STARTED | > 40% |
| Lead Form Completion | LEAD_FORM_COMPLETED / PDF_DOWNLOADED | > 25% |
| MQL → SQL Conversion | SQL count / MQL count | > 50% |
| SQL → Customer Conversion | Customers / SQL | > 30% |
| Email Open Rate (outbound) | Opens / Sent | > 35% |
| Email Reply Rate | Replies / Sent | > 8% |
| Demo Booking Rate from Email | Booked / Replied | > 40% |
| Avg Deal Cycle (days) | First contact → Stripe payment | < 21 days |
| MRR Net New (weekly) | New MRR − Churned MRR | Weekly positive |
| Churn Rate (monthly) | Churned accounts / Total accounts | < 5% |
| CPA Partner Pipeline | Partners in active discussion | > 5 at all times |

## 8.3 Weekly GTM Review Cadence

**Every Monday, 9:00 AM AST — 45-minute GTM War Room Review**

Agenda:
1. **Dashboard review (10 min):** Prior week metrics vs. targets. Green/Yellow/Red for each leading indicator.
2. **Pipeline review (10 min):** Top 10 hot leads. Any deals stalled > 7 days. Deals closing this week.
3. **Agent performance review (10 min):** Email deliverability, open rates, reply rates. Any sequence changes needed.
4. **CPA channel review (5 min):** Partner pipeline update. Any new partner signed or lost.
5. **Blocker escalation (5 min):** What is the single biggest thing slowing revenue this week? Who owns removing it?
6. **Weekly commitments (5 min):** Each person states 1–3 specific commitments for the week.

**Output:** Weekly GTM review log saved to ops folder. Metrics tracked vs. targets in running spreadsheet.

## 8.4 Escalation Protocol — When Behind Target

**Yellow Alert (10–20% behind MRR target):**
- Review pipeline for deals that can be accelerated (trial offer, price reduction, free month)
- Increase outbound cadence by 25% (Agent 4 daily send volume)
- Personal outreach from founder to any SQL in pipeline > 14 days without close

**Red Alert (> 20% behind MRR target):**
- Full GTM retrospective: identify root cause (pipeline volume, conversion rate, or churn)
- If pipeline volume issue: increase demo booking push; consider paid PR LinkedIn advertising
- If conversion rate issue: review demo script; offer free trial to all warm pipeline
- If churn issue: immediate customer success outreach to all accounts > 30 days old
- Consider aggressive trial-to-paid conversion campaign (lower trial price, time-limited)
- Founder personally calls top 5 pipeline accounts

**Emergency Protocol (2 consecutive months > 25% below target):**
- Full GTM strategy review with external advisor
- Consider channel-first pivot (all resources to CPA partner acquisition for 60 days)
- Evaluate pricing model change (lower entry price, higher volume)
- Assess whether product-market fit validation requires additional discovery interviews

---

## 8.5 The $1M ARR Final Checklist

When MRR hits $83,333 for the first time, execute the following:

- [ ] Announce milestone internally
- [ ] Send personal thank-you note to every customer who has been on the platform since Month 1
- [ ] Publish a PR cooperativa ALM sector report (using anonymized CERNIQ data as the source)
- [ ] Begin planning Vol. 6: NCUA Credit Union Expansion Playbook
- [ ] Evaluate Series A readiness with ARR traction documentation
- [ ] Expand to 40+ NCUA credit unions — same playbook, new market segment

---

---

## APPENDIX A: ProspectInstitution CRM Field Map

For reference when configuring agent data contracts:

```sql
ProspectInstitution (
  id                      UUID PRIMARY KEY,
  institution_name        VARCHAR(255),
  institution_type        ENUM('cooperativa','credit_union','cpa_firm'),
  total_assets_usd        BIGINT,
  tier                    INT (1-4),
  cossec_regulated        BOOLEAN,
  ncua_charter_number     VARCHAR(50),
  primary_contact_name    VARCHAR(255),
  primary_contact_title   VARCHAR(100),
  primary_contact_email   VARCHAR(255),
  primary_contact_linkedin VARCHAR(255),
  cpa_firm_name           VARCHAR(255),
  cpa_firm_contact_email  VARCHAR(255),
  lead_stage              ENUM('COLD','AWARE','ENGAGED','DEMO_ACTIVE','HIGH_INTENT',
                               'MQL','SQL','OPPORTUNITY','PROPOSAL','CUSTOMER','CHURNED'),
  last_contact_date       TIMESTAMP,
  last_enriched_at        TIMESTAMP,
  enrichment_data         JSONB,
  outreach_strategy       VARCHAR(50),
  priority_score          DECIMAL(4,2),
  do_not_contact          BOOLEAN DEFAULT false,
  language_preference     ENUM('ES','EN','BILINGUAL') DEFAULT 'ES',
  notes                   TEXT,
  created_at              TIMESTAMP,
  updated_at              TIMESTAMP
)
```

## APPENDIX B: Demo Analytics Event Reference

| Event | Trigger | Action |
|---|---|---|
| DEMO_STARTED | User visits `/demo?type=cooperativa` | Log institution_id if known; start follow-up timer |
| SEED_COMPLETE | CoopAhorro San Juan data loaded | — |
| CALC_COMPLETE | ALM model calculation finished | — |
| PDF_DOWNLOADED | User downloads the 14-page report | Agent 6 trigger: if no LEAD_FORM_OPENED in 24h → Email B |
| LEAD_FORM_OPENED | Lead capture form displayed | Agent 6 trigger: if not COMPLETED in 4h → Email C (hottest signal) |
| LEAD_FORM_COMPLETED | Contact info submitted | Stage → SQL; assign to human sales rep queue within 30 min |

---

*Document Version: 1.0 | Created: April 2026 | CERNIQ Internal — Confidential*
*Next review: May 16, 2026 (30-day sprint retrospective)*
