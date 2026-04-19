# CERNIQ GTM + ICP Handoff for Claude

Date: 2026-04-17
Owner context: Cerniq repo current-state synthesis
Purpose: Give Claude a grounded, repo-backed understanding of CERNIQ's current go-to-market goals, ICP, messaging, channel priorities, and contradictions.

## 1. Executive Summary

As of April 17, 2026, CERNIQ's current commercial wedge is:

**Bilingual ALM reporting software for Puerto Rico cooperativas, with credit unions as the adjacent expansion path and CPA firms as the highest-leverage channel.**

The repo consistently supports a narrow, wedge-first motion more credibly than a broad "financial intelligence platform" story.

If Claude needs a one-line description to use in strategy, copy, or planning work, use:

**CERNIQ helps cooperativas and credit unions upload a balance sheet and generate a board-ready bilingual ALM report in minutes instead of weeks.**

## 2. What Counts as Source of Truth

Use this precedence order when Claude finds conflicting material:

1. Active product code and current product constants
2. Narrow strategy docs that were written to reduce positioning drift
3. Short-horizon operating docs for the current sales motion
4. Older GTM "Bible" docs only as long-range strategy, not current public truth

Most useful current-state files:

- `docs/prompts/POSITIONING.md`
- `docs/prompts/ICP_STRATEGY.md`
- `docs/strategy/icp_segments.md`
- `docs/strategy/value_proposition.md`
- `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`
- `frontend/lib/pricing.ts`
- `frontend/app/page.tsx`
- `backend-node/src/leads/prospect-seed.ts`
- `docs/sales/OUTBOUND_PLAYBOOK.md`
- `docs/analysis/DRIFT_REPORT.md`
- `docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`

## 3. Current GTM Goal

The current GTM goal is not "sell the whole platform." It is:

- Prove a narrow ALM reporting wedge with real institutions
- Convert founder-led outbound into pilots and then recurring revenue
- Keep public messaging much narrower than the repo's total feature surface
- Build credibility first in Puerto Rico cooperativas, then expand carefully

Operationally, the repo points to this near-term motion:

- Sell a focused ALM workflow
- Lead with secure upload -> analysis -> bilingual report output
- Use sample reports, demos, and pilot offers as the trust-building mechanism
- Hide or de-emphasize unrelated product breadth in customer-facing messaging

The cleanest current framing from the repo is in `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`:

- revenue proof over feature breadth
- narrow, credible, sellable wedge
- public emphasis on landing, pricing, demo, login, institution creation, upload, report generation, report download, portal/status

## 4. Current ICP

### Primary ICP

Primary ICP:

- Puerto Rico cooperativas

Why this is the true primary ICP:

- Repo-wide positioning repeatedly centers cooperativas
- Product language is COSSEC-aware and bilingual
- Prospect seed data is cooperativa-first
- Demo, outreach, and sample-report motions are written around cooperativa workflows

Evidence:

- `docs/strategy/icp_segments.md`
- `docs/prompts/ICP_STRATEGY.md`
- `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`
- `backend-node/src/leads/prospect-seed.ts`
- `frontend/app/page.tsx`

### Secondary ICP

Secondary ICP:

- Credit unions

Important nuance:

- Credit unions are real and supported in code and messaging
- They are not the sharpest near-term wedge compared with PR cooperativas
- They should be treated as adjacent expansion, not the main narrative driver

Evidence:

- `docs/strategy/icp_segments.md`
- `docs/prompts/ICP_STRATEGY.md`
- `frontend/app/page.tsx`

### Channel ICP

Channel ICP:

- CPA firms and advisory firms serving cooperativas and credit unions

This is not just an "extra segment." It is the highest-leverage channel hypothesis in the deeper GTM docs.

Why this matters:

- One CPA relationship can unlock multiple institutions
- The repo already supports partner/multi-client ideas
- White-label and partner concepts appear across pricing, schema, and sales docs

Evidence:

- `docs/strategy/icp_segments.md`
- `docs/prompts/ICP_STRATEGY.md`
- `docs/sales/OUTBOUND_PLAYBOOK.md`
- `frontend/lib/pricing.ts`
- `backend-node/prisma/schema.prisma`

### Segments to Treat as Future or Soft-Supported

These appear in parts of the repo but should not drive current strategy:

- community banks
- treasury departments as a standalone ICP
- broad institutional finance teams
- family offices
- generic enterprise buyers

These are either secondary code options, speculative expansion targets, or leftover positioning noise.

## 5. Buyer Personas

Current buyer/persona stack from the repo:

### 1. CFO / Director Financiero

Primary economic buyer and best first-contact persona.

Core pain:

- Board-ready reporting takes too long
- Too much manual spreadsheet and document assembly
- Reporting cycles are stressful and expensive
- Bilingual output for board/regulatory contexts is painful manually

### 2. Risk Manager / Risk Officer / Compliance Lead

Strong secondary persona when the institution is more mature.

Core pain:

- Needs defensible ALM metrics
- Needs regulator-ready documentation
- Needs faster scenario and sensitivity analysis

### 3. Treasury / Finance Operations Lead

Useful especially for rate-sensitivity and NII conversations.

Core pain:

- Needs faster rate-scenario analysis
- Needs quicker answers to Fed/rate-shock questions

### 4. CPA Partner / Financial Consultant

Channel persona, not just an end buyer.

Core pain:

- ALM work is labor-intensive and hard to scale
- Wants a productized, repeatable workflow across multiple institutions
- Wants higher-margin delivery and possible white-label positioning

## 6. Core Problem Statement

CERNIQ is solving a very specific operational problem:

- ALM reporting is slow
- It is spreadsheet-heavy
- It often depends on expensive consultants
- It creates delays before board, ALCO, and exam deadlines
- Spanish/English output adds more manual work

The wedge is not "better analytics" in the abstract.

The wedge is:

- faster workflow
- bilingual delivery
- board-ready output
- compliance-ready packaging
- lower operational friction

This theme is consistent across:

- `docs/strategy/value_proposition.md`
- `docs/prompts/POSITIONING.md`
- `docs/prompts/ICP_STRATEGY.md`
- `docs/sales/MOM_TEST_DISCOVERY.md`
- `docs/demo/PRICING_ONE_PAGER.md`

## 7. Current Value Proposition

Best current value proposition:

**Upload balance sheet -> generate bilingual ALM report.**

Supporting messages that are consistent with the repo:

- fast, credible ALM reporting
- upload your balance sheet, get a board-ready report
- replace manual ALM spreadsheets
- professional risk reports in minutes, not weeks
- secure upload, analysis, and bilingual PDF delivery in one workflow

Messages to avoid:

- AI platform
- financial OS
- analytics platform
- Bloomberg-style platform
- enterprise intelligence platform
- institutional operating system

Those appear as roadmap or legacy aspiration, not current wedge truth.

Primary source:

- `docs/prompts/POSITIONING.md`

## 8. Current Channel Strategy

### Primary Channel: Founder-led outbound

The repo's short-term execution docs clearly favor founder-led outbound as the active motion.

Main outbound surfaces:

- LinkedIn outreach to cooperativa executives
- email sequences personalized with COSSEC/public data
- warm phone or WhatsApp follow-up
- demo/sample-report offer as CTA

Core style of outreach:

- personalized
- Spanish-first for PR cooperativas
- public-data-backed
- free sample report / benchmark / pilot-oriented

Best supporting docs:

- `docs/sales/OUTBOUND_PLAYBOOK.md`
- `docs/sales/DAILY_EXECUTION_PLAN.md`
- `docs/content/linkedin_outreach_templates.md`

### Highest-Leverage Channel: CPA partner distribution

The long-form GTM docs are much more aggressive about the CPA channel than the short execution docs.

Interpretation:

- direct outbound is the immediate active motion
- CPA firms are the most important multiplier channel once the wedge is credible

Practical guidance for Claude:

- treat CPA firms as a strategic growth lever
- do not let CPA-channel ambition blur the primary wedge
- position partner motion as the next leverage layer, not the only story

### Product-led elements

There are product-led pieces, but they support the sales motion rather than replace it:

- public demo
- sample report
- pricing page
- lead capture
- pilot checkout flow

Current GTM is not a pure self-serve SaaS motion.
It is a founder-led, proof-asset-led sales motion with software credibility.

## 9. Current Offer Strategy

The repo strongly suggests a staged offer strategy:

1. Low-friction pilot / first report
2. Recurring platform access after trust is earned
3. Partner plan for CPA/multi-client workflows

This sequencing matters more than any single price point.

Core commercial logic:

- reduce buying friction
- prove output quality on real data
- convert trusted pilots into recurring usage

## 10. Pricing: Current Reality and Conflicts

This is the most important contradiction Claude needs to know.

### Active product pricing constants

The strongest code-backed pricing source is:

- `frontend/lib/pricing.ts`

That file currently defines:

- Setup / one-time: `$750`
- Pilot: `$2,500/month`
- Standard: `$3,500/month`
- Partner: `$499/month`

### Older and still-present sales pricing

Multiple sales/docs artifacts still use:

- pilot / single report: `$750`
- recurring platform: `$299/month`
- partner: `$499/month`

Seen in:

- `docs/demo/PRICING_ONE_PAGER.md`
- `docs/sales/OUTBOUND_PLAYBOOK.md`
- `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`
- `docs/strategy/CERNIQ_VALUATION.md`

### How Claude should handle this

Unless the task is explicitly about legacy sales collateral, Claude should assume:

- active product pricing has moved upmarket
- the current code-level pricing reference is the stronger source of truth
- older `$299/month` and related pricing belong to earlier wedge validation material

Best way to describe the conflict:

- **Operational/collateral docs still reflect an earlier low-friction pilot-era pricing ladder**
- **current frontend pricing constants reflect a more enterprise/upmarket packaging**

If Claude is asked to rewrite sales collateral, it should first decide whether the intended commercial strategy is:

- low-friction founder-led pilot motion, or
- current higher-ticket pilot + standard packaging

## 11. Current Short-Term GTM Goals

Repo-grounded short-term goals:

- tighten public positioning around the ALM wedge
- remove or ignore broader platform claims
- make the landing-to-report flow credible and demo-safe
- create proof assets that can be used in real selling
- start or continue founder-led outbound
- convert interest into pilots
- convert pilots into recurring usage

Concrete short-horizon targets found in the repo include:

- first paying customers
- 3 pilot conversations or proposals
- 3 active/completed pilots
- 1-3 paid conversions in the first monthly cycle
- one sample report and one walkthrough asset
- targeted institution list for PR cooperativas

Key sources:

- `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`
- `docs/sales/DAILY_EXECUTION_PLAN.md`
- `docs/sales/OUTBOUND_PLAYBOOK.md`

## 12. Longer-Range GTM Ambition

The bigger GTM docs show a much more expansive ambition:

- dominate top cooperativas
- build CPA partner distribution
- expand into credit unions
- move toward significant ARR milestones
- create a defensible Puerto Rico-specific moat

These files are useful for roadmap and strategic upside:

- `docs/GTM_PRODUCT_BIBLE.md`
- `docs/CERNIQ_Vol5_GTM_WAR_ROOM_BIBLE.md`
- `docs/CERNIQ_Vol7_REVENUE_INTELLIGENCE_BIBLE.md`

But Claude should not mistake them for current public-market truth.

Use them as:

- long-range vision
- channel hypotheses
- persona and content ideas
- revenue architecture inspiration

Do not use them as the final word on current pricing, current proof, or externally safe claims.

## 13. What Is Actually Implemented Enough to Sell

Repo evidence suggests CERNIQ can credibly sell:

- secure-ish balance-sheet upload workflow
- ALM analysis workflow
- bilingual report generation
- portal/report retrieval
- lead capture and prospect seeding
- outbound personalization and sample-report style motions

Repo evidence does not support selling CERNIQ primarily as:

- a broad financial intelligence operating system
- a fully proven enterprise risk platform
- a fully validated multi-product institution suite

This distinction is reinforced by:

- `docs/analysis/DRIFT_REPORT.md`
- `docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`
- `docs/strategy/value_proposition.md`

## 14. Current Market Wedge in Plain English

If Claude needs to explain CERNIQ simply:

- Puerto Rico cooperativas have recurring ALM and compliance-adjacent reporting pain
- much of the workflow is manual, consultant-heavy, and document-heavy
- CERNIQ compresses that workflow into an upload-to-report product
- the bilingual and Puerto Rico-specific angle is a real differentiator
- the first practical growth path is founder-led outbound plus selective CPA channel development

## 15. Recommended Assumptions for Claude

Claude should assume the following unless explicitly told otherwise:

- Primary market: Puerto Rico cooperativas
- Adjacent market: credit unions
- Channel strategy: founder-led outbound first, CPA channel second
- Core buyer: CFO / Director Financiero
- Product story: bilingual ALM reporting, not broad enterprise finance software
- Core workflow: upload -> analyze -> bilingual PDF/report delivery
- Best differentiators: speed, bilingual output, Puerto Rico/COSSEC fit, lower manual burden
- Public messaging should stay narrow
- Broader platform surfaces in the repo are mostly supporting complexity or future option value

## 16. Questions Claude Should Resolve Before Major GTM Work

If Claude is asked to produce copy, packaging, pricing, or sales systems, it should first resolve:

1. Which pricing ladder is current for the task?
2. Is the task for public website copy, founder outbound, or internal strategy?
3. Should credit unions be treated as active secondary outreach now, or only as expansion?
4. Is the near-term plan still low-friction pilot-first, or has CERNIQ already moved to higher-ticket pilot packaging?
5. How much of the CPA partner motion is real now versus planned?

## 17. Bottom Line

The clearest current answer is:

CERNIQ's current GTM goal is to win a narrow ALM-reporting wedge in Puerto Rico by helping cooperativas move from manual spreadsheet-driven reporting to fast, bilingual, board-ready output, then turn that proof into recurring revenue and selective CPA-channel expansion.

Its current ICP is:

- **Primary:** Puerto Rico cooperativas
- **Secondary:** credit unions
- **Channel:** CPA/advisory firms serving multiple institutions

Its safest current public story is:

**Bilingual ALM reporting software for cooperativas and credit unions.**

Its biggest strategic risk is still positioning drift:

- saying the company is broader than the repo and revenue proof currently justify
- mixing old and new pricing models
- letting future-platform ambition dilute the current wedge

## 18. File Reference Index

- `docs/prompts/POSITIONING.md`
- `docs/prompts/ICP_STRATEGY.md`
- `docs/strategy/icp_segments.md`
- `docs/strategy/value_proposition.md`
- `docs/CERNIQ_30_DAY_OPERATOR_PLAYBOOK.md`
- `docs/sales/OUTBOUND_PLAYBOOK.md`
- `docs/sales/DAILY_EXECUTION_PLAN.md`
- `docs/sales/MOM_TEST_DISCOVERY.md`
- `docs/content/linkedin_outreach_templates.md`
- `docs/demo/PRICING_ONE_PAGER.md`
- `docs/strategy/CERNIQ_VALUATION.md`
- `docs/analysis/DRIFT_REPORT.md`
- `docs/CERNIQ_ENTERPRISE_REPO_BASELINE.md`
- `frontend/lib/pricing.ts`
- `frontend/app/page.tsx`
- `backend-node/src/leads/prospect-seed.ts`
- `docs/GTM_PRODUCT_BIBLE.md`
- `docs/CERNIQ_Vol5_GTM_WAR_ROOM_BIBLE.md`
- `docs/CERNIQ_Vol7_REVENUE_INTELLIGENCE_BIBLE.md`
- `docs/CERNIQ_MASTER_BIBLE_v2.md`
