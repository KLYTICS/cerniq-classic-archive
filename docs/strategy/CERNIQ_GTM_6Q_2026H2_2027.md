# CerniQ — Six-Quarter Go-To-Market Plan
## Q3 2026 → Q4 2027 · Content, DMs, Cold Email Infrastructure, and the Liga Cooperativa Entry

> **Status:** Operating plan. Supersedes the 30/60/90 sprints in `CERNIQ_Vol5_GTM_WAR_ROOM_BIBLE.md` §1.3 (expired 2026-07-15).
> **Grounded in:** `CERNIQ_MARKET_BIBLE.md` (sector data, org charts, named people), `sales/OUTBOUND_PLAYBOOK.md`, `ops/resend_dns_setup.md`, `ops/dmarc_inbox_setup.md`.
> **Written:** 2026-07-25 · **Baseline:** $0 revenue · solo founder · ~$1–2K/mo tooling · zero warm relationships in the Liga/ASEC/COSSEC/CPA ecosystem.
> **Refresh cadence:** end of each quarter, aligned to the COSSEC statistical PDF release (~75 days after quarter close).

---

## 0. Read this first — the four constraints and what they force

You gave four inputs. Each one closes off options that the existing GTM docs leave open. Being explicit about this is the difference between a plan and a wish list.

| Constraint | What it forces |
|---|---|
| **$0 revenue, product live since March 2026** | Q3'26 has exactly one job: **signed design partners.** Not MRR, not channel, not events. Every other workstream in Q3 exists only to produce that outcome. The `$1M ARR by Sept 2027` map in Vol.5 §1.4 was built on an April-2026 assumption of first-dollar-in-May. That didn't happen. It is not reachable from here and planning against it will cause you to skip the steps that actually work. |
| **Solo founder, $1–2K/mo** | **Strict sequencing, not parallelism.** You cannot run direct outbound + video + CPA channel + Liga + events concurrently. Each quarter opens exactly one new motion and only after the previous one has a proof point. The budget is *not* your binding constraint — $1–2K/mo is generous for a 91-institution TAM. **Your hours are.** Spend money to buy back time, not to buy more tools. |
| **80% faceless / 20% face video** | This is the correct ratio for this market, and not as a compromise. The most persuasive video asset available to you is **the product generating a report**, not your opinions. Faceless screen capture is your flagship format, not your fallback. |
| **Fully cold — no Liga/ASEC/COSSEC/CPA relationships** | You cannot ask for access. You have to **earn legibility first**. The Liga entry is a publish-then-ask sequence spanning three quarters, not a meeting request. See §4. |

### The one thing in your current plan that will hurt you

`sales/OUTBOUND_PLAYBOOK.md` Channel 2 says to cold-email prospects from `erwin@cerniq.io` via Resend. **Do not do this.** Two independent reasons, either one sufficient:

1. **Resend — like every transactional ESP (Postmark, SendGrid, Mailgun, SES) — prohibits unsolicited outreach in its acceptable-use policy.** If flagged, you don't just lose outbound. You lose the account that delivers your *product*: report-ready notifications, portal links, invoices, password resets. You would take the product down in order to send prospecting mail.
2. **Domain reputation is shared and slow to repair.** `cerniq.io` is your product domain. Most PR cooperativas sit behind Microsoft 365 or Google Workspace. If `cerniq.io` acquires a spam reputation at Microsoft, your *paying customer's* report notification lands in Junk. That is an unrecoverable trust failure with an account you spent six months winning.

The fix is architectural separation, specified in full in §6.2. It costs about $50/month and one afternoon.

---

## 1. The strategic frame

### 1.1 The governing number: 91

There are **91 COSSEC-insured cooperativas de ahorro y crédito**, holding $12.48B in assets and 1.16M members (COSSEC, Dec 2025). Forty of them — those above $100M — hold **84.2% of system assets**. Your realistic ICP is ~60 institutions. Across those, the relevant humans (Presidente Ejecutivo, Gerente de Finanzas, Gerente de Riesgo, Presidente de Junta, Tesorero) number roughly **250–350 people. That is the entire universe.**

Everything downstream follows from that number.

### 1.2 The reputation constraint — why "DM around the clock" as volume would kill this

In a normal SaaS market you optimize volume × conversion, and a burned prospect costs you one prospect. Here it does not work that way.

The CEOs of these institutions sit together on ASEC's board. They meet at six Consejos Regionales. Liga's Junta de Directores has a representative from every region and from Banco Cooperativo, COSVI, and Seguros Múltiples. This is a 350-person professional network with dense, institutionalized, recurring contact.

If you send 300 templated DMs, a meaningful fraction get discussed with a peer inside a week. Burn 10 accounts and you haven't lost 10 prospects — you've lost 11% of the TAM *and* seeded a reputation that arrives before you do. There is no growth-hacking your way out of that; the market is too small to outrun word of mouth.

**Operating principle: reputation is the scarce asset, not attention.**

The test for every asset and every message: *would a Gerente de Finanzas forward this to their ALCO chair without embarrassment?* If no, don't send it.

**This does not mean working less.** It means the round-the-clock effort goes into a different verb. See §7.1.

### 1.3 The three wedges, ranked

You need a reason to exist in a specific institution's Q3 2026, not a general value proposition. There are three, and they are not equal.

#### Wedge 1 — FHLBNY membership *(sharpest, most urgent, uncontested)*

This is the best cold-open available in this market right now, and it has a second-order angle nobody is selling.

**The first-order facts** (Market Bible §8): Ley 73-2025 authorized cooperativa FHLB membership. COSSEC and FHLBNY announced eligibility Jan 27, 2026. The April 2026 *Cumbre de Acceso a Capital Cooperativo* drew **57+ cooperativas with mortgage portfolios**. La Sagrada Familia (Corozal) was admitted April 30, 2026 — the first ever. LarCoop is second in line. The $2.05B system mortgage book is the collateral.

The membership requirements are, almost comically, CerniQ-shaped:
- Two years of **audited GAAP financial statements in Spanish AND English**
- **Monthly loan-level mortgage collateral reporting** in the COL-121 layout
- **Annual attestation of compliance with COSSEC Reglamento 8665 Art. 2.18.2**

**The second-order angle — this is the actual wedge.** These cooperativas have been almost entirely **deposit-funded** for their entire existence. The moment a cooperativa takes its first FHLBNY advance, it acquires **wholesale funding**, and its interest-rate-risk profile changes in a way its ALCO has never had to model. There is no institutional memory for this. There is no vendor on the island addressing it. And COSSEC has publicly committed *acompañamiento técnico y regulatorio* to applicants, which means the regulator is pushing coops toward exactly the exposure you model.

The sentence that opens doors:

> *"Cuando su cooperativa tome su primer adelanto del FHLBNY, su perfil de riesgo de tasa cambia. ¿Su comité ALCO tiene el modelo para eso?"*

Nobody has asked them that. It is not a pitch — it is a question a competent person would ask, and it is unanswerable without something like CerniQ.

#### Wedge 2 — RAP → GAAP by 2028, and the triple CAEL

Every cooperativa must complete the RAP→GAAP transition (COSSEC Fiscal Plan; Ley 99-2024 moved the date from Jan 2028 to June 2028, contested by the FOMB). That is a **forced, dated, budgeted project with roughly a two-year runway** — and it lands squarely inside the 6-quarter window of this plan.

Compounding it: since March 2024, every cooperativa files **three parallel CAEL reports every quarter** in AITSA (Reglamento 7790 CAEL, CAEL-with-CECL, and CAEL Piloto with Net Equity Ratio). That is pure, recurring, un-automated manual pain that every finance manager on the island feels four times a year.

**Caveat for sales use:** the operative date is genuinely in flux. Never make a sale contingent on a specific deadline. Sell the capability; cite the deadline as context.

#### Wedge 3 — Rising examiner expectations

COSSEC received **NASCUS accreditation in June 2025** — the first ever — and has held an **NCUA MOU since 2023** covering examiner training and enhanced supervision. Examiners are now being trained to mainland standards.

The implication, stated plainly to a CFO: *the IRR and ALM documentation that passed your 2022 exam will not pass your 2027 exam.* This is the urgency argument that converts an interested CFO into a budget request. It is not a cold-open — it's the close.

### 1.4 The real clock

You are at $0 on July 25, 2026. Puerto Rico cooperativas are calendar-year institutions; budgets are typically drafted September–November and approved by the Junta de Directores in November–December.

**There are roughly 14 working weeks between today and the moment the 2027 budgets lock.** If CerniQ is not a line item in a cooperativa's 2027 budget by late November 2026, that institution is a 2028 customer.

That single fact determines the entire shape of Q3 and Q4 2026.

---

## 2. Positioning and the offer

### 2.1 Positioning stays where `prompts/POSITIONING.md` put it

Do not drift. External language remains: **bilingual ALM reporting software for cooperativas and credit unions. Upload balance sheet → board-ready bilingual report.** No "AI platform," no "financial OS," no "Bloomberg-style." Those claims are unearned at 0 customers and they read as noise to a CFO who has been quoted $15,000 for a real report.

What this plan *adds* to the positioning is a **campaign-level wedge** layered on top of the stable product positioning: for Q3–Q4 2026, CerniQ goes to market as *"the ALM model for cooperativas entering the FHLBNY system."* That's a spearhead, not a repositioning. The product description underneath it doesn't change.

### 2.2 The offer ladder — and the asset that makes it work

At 0 customers, cold, your first ask must require **no budget decision, no data from them, and no meeting.**

Here is the move that makes this possible, and it is the highest-leverage GTM asset available to you today:

> **The COSSEC quarterly statistical PDF — specifically Anejo 9 — publishes every insured cooperativa's charter number, total assets, member count, and employee count. The full report publishes sector-level loan mix, yields, delinquency, capital ratios, and regional aggregates.**
>
> **That is enough to produce a credible, specific, institution-vs-sector analysis for any of the 91 cooperativas without them sending you a single file.**

#### Asset #1: **El Pre-Informe** (the unsolicited pre-report)

A 4–6 page bilingual PDF, generated for a *named* cooperativa, entirely from public COSSEC data:

- Their capital/assets ratio vs. sector median and vs. their regional Consejo
- Their loan mix vs. system mix (personal 37.3% / mortgage 26.6% / auto 25.1% / commercial 7.1%)
- Their morosidad vs. system 2.32%
- An estimated duration profile and rate-shock sensitivity band derived from the sector's disclosed yield structure
- **A "what changes if you take FHLBNY advances" scenario** — the wedge, made concrete for their balance sheet
- An explicit, honest methodology note: what is measured, what is estimated, and what would sharpen with their actual data

This costs you a script run. It proves the product without a demo, without a call, and without asking them for anything. It is the single best cold-open artifact in this market and it is computable from data you already have parsed.

**Build the generator in Week 1.** It is the highest-ROI engineering task in this entire plan.

#### The ladder

| Rung | Offer | Price | Ask |
|---|---|---|---|
| 0 | **El Pre-Informe** — built from public COSSEC data, unsolicited | Free | Nothing. "¿Se lo envío?" |
| 1 | **Informe Piloto** — full report from their real extract | Free for the first **3 design partners**; $1,500 thereafter | A named, quotable testimonial + logo rights + a 45-min feedback session |
| 2 | **Plataforma** — subscription | See §2.3 | Annual commitment, quarterly cadence |
| 3 | **Canal CPA** — white-label, multi-institution | See §2.3 | Partner agreement |

### 2.3 Pricing — resolve the inconsistency, and raise the floor

**First, a housekeeping problem.** Your artifacts disagree:

| Source | Pilot | Platform | Partner |
|---|---|---|---|
| `demo/PRICING_ONE_PAGER.md` | $750 | $299/mo | $499/mo |
| `Vol5 §1.4` | $499/report | $399/mo Direct, $799+/mo Enterprise | $199/mo + per-report |
| `sales/OUTBOUND_PLAYBOOK.md` | $750 vs "$8K–$12K consultants" | — | — |
| `CERNIQ_MARKET_BIBLE.md §1.2` | — | benchmark: **$15,000** minimum consultant engagement | — |

Also: `PRICING_ONE_PAGER.md` lists `pablo@cerniq.com` as the contact. Fix both before a single outbound email goes out. Nothing kills institutional credibility faster than a prospect finding two prices.

**Second, a strategic recommendation: kill the $299/mo tier.**

In a market where the incumbent alternative costs $8,000–$15,000 per quarter, $299/month does not read as a bargain to a CFO. It reads as *not serious* — as something that cannot possibly withstand an examiner's scrutiny. In institutional finance, underpricing is a **trust signal problem**, not a value signal. You are asking a regulated institution to replace a $15K consultant deliverable that goes in front of a board and an examiner. Price it like it belongs in that conversation.

Recommended structure (adjust to your cost model, but hold the floor):

| Tier | Fit | Price | Annual | vs. consultant |
|---|---|---|---|---|
| Informe Piloto | Evaluation | $1,500 one-time (waived ×3) | — | — |
| **Plataforma Esencial** | <$200M assets | $950/mo | $11.4K | ~70% saving vs. $32–48K/yr |
| **Plataforma Institucional** | >$200M assets | $1,850/mo | $22.2K | ~60% saving vs. $48–60K/yr |
| **Socio CPA** | Advisory firms | $1,200/mo + $350/institution/quarter | — | Firm resells at their own rate |

At Esencial, an $11.4K annual line item sits comfortably inside a $150M cooperativa's professional-services budget and is defensible to a board as a *reduction*. At $299/mo it invites the question "what's wrong with it."

**One nuance worth holding:** you have zero customers, so this is a hypothesis. Test it on the first three paid conversations before hardcoding it into the website. But test it at the higher number — it is much easier to discount than to raise.

---

## 3. The six-quarter arc

### 3.1 Overview

| Quarter | Codename | The single job | New motion opened | Base-case accounts (cum.) | Exit MRR |
|---|---|---|---|---|---|
| **Q3 2026** (Aug–Sep) | **PRIMERA FIRMA** | Sign 2 design partners | Direct outbound + video | 2 (unpaid/pilot) | $0–1.5K |
| **Q4 2026** (Oct–Dec) | **PRESUPUESTO 2027** | Land in 15+ institutions' 2027 budgets | Liga/PR Cooperativista + first case study | 4 paying | $3.5–5K |
| **Q1 2027** (Jan–Mar) | **CONVENCIÓN** | Convert budgeted deals; ASEC presence | ASEC + CPA channel | 9 | $9–11K |
| **Q2 2027** (Apr–Jun) | **CANAL** | Make someone else sell for you | CENASE + CPA white-label live | 16 | $17–19K |
| **Q3 2027** (Jul–Sep) | **SISTEMA** | Become infrastructure, not a vendor | Core/AITSA integration + BanCoop | 24 | $26–29K |
| **Q4 2027** (Oct–Dec) | **EXPANSIÓN** | 2028 budgets at scale + next market | Adjacent-market beachhead | 34 | $37–40K |

**Base case exit: ~34 accounts, ~$38K MRR, ~$450K ARR run-rate** — roughly 55% penetration of the realistic 60-institution ICP, in 18 months, from zero, solo.

**Stretch case** (CPA channel produces a genuine multiplier from Q2'27): 45–50 accounts, ~$600K ARR.

**Why not $1M.** Vol.5's $1M-by-Sept-2027 assumed first dollar in May 2026 and ~130–150 accounts. 130 accounts does not exist: there are only 91 institutions, ~60 of which can plausibly afford the product. The $1M target is only reachable through (a) a materially higher ACV, (b) the CPA channel behaving as a true reseller, or (c) an adjacent market. This plan builds toward (a) and (b) and opens (c) in Q4'27. Treat $1M as a **2028 milestone**, and say so out loud so you stop measuring yourself against a number the market can't produce.

---

### 3.2 Q3 2026 — **PRIMERA FIRMA** (Aug 1 – Sep 30)

**Theme: earn the right to exist. Two signed design partners or nothing else matters.**

Everything in this quarter is instrumental to that one outcome. If a workstream doesn't move a named institution toward signing, it doesn't happen this quarter.

#### Objectives

| # | Objective | Target | Why |
|---|---|---|---|
| 1 | **Signed design partners** | **2** | The only real objective. Unpaid is fine. Named + quotable is not optional. |
| 2 | Pre-Informes generated and delivered | 40 | One per Tier 0/1 institution. This is the campaign. |
| 3 | Cold email infrastructure live and warmed | 6 mailboxes, 3 domains | Per §6. Warmed by ~Aug 21. |
| 4 | Video assets published | 8 (~1/week) | Per §5. F1 flagship + F2 index + 4× F3 + 2× F4. |
| 5 | **Índice CerniQ published** (first edition) | 1 | Per §4.1. Published within 7 days of the Q2-2026 COSSEC PDF (~mid-Sept). This is the Liga Trojan horse. |
| 6 | Liga + ASEC contact opened | 4 emails sent, rate cards in hand | Grace Matos, Lissette Estevez, Dahlia Torres. Information requests, not pitches. |
| 7 | Account plans built | 40 (Tier 0 + Tier 1) | Per §8. |
| 8 | Discovery conversations held | 15 | Mom-Test format, no pitch. Use `sales/MOM_TEST_DISCOVERY.md`. |

#### The Q3 campaign, in sequence

**Weeks 1–2 (Jul 27 – Aug 9) — Build.** Infrastructure, Pre-Informe generator, list, account plans, first video. Detail in §12. **Zero cold sends from new infrastructure** — it's warming.

**Weeks 1–4 — Tier 0 runs in parallel, by hand.** The top 15 cooperativas by assets are **never** put through a sequencing tool. Fifteen emails is not an automation problem. Erwin writes each one personally from `erwin@cerniq.io`, referencing that institution's actual Anejo 9 numbers and — where they hold mortgages — the FHLBNY angle. One email, one follow-up seven days later, then the channel shifts to phone and LinkedIn. This costs you ~6 hours total and protects the 15 accounts you cannot afford to burn.

**Weeks 3–8 (Aug 10 – Sep 20) — Tier 1 sequences go live.** 25 institutions, ~90 contacts, through the warmed cold infrastructure. 15–25 sends/day. The Pre-Informe is the payload on touch 2.

**Weeks 5–9 — Field motion.** One day per week driving. Arecibo (COOPACA, Zeno Gandía — $3,004M regional assets), the west (Rincón at $905M is the largest institution on the island, Isabela, Cabo Rojo, Mayagüez — $2,182M regional), and Caguas ($3,311M, the largest region). Show up at the branch, ask for the Gerente de Finanzas, leave the Pre-Informe. A physical visit to a $900M cooperativa is worth more than 200 emails and there is no vendor in this market doing it.

**Week 8 (~mid-Sept) — Índice CerniQ, edition one.** The Q2-2026 COSSEC statistical PDF publishes around mid-September. Publish your analysis within 7 days. Send it to every sector journalist (NotiCel, El Vocero, Sin Comillas, Semanario Visión, Primera Hora) and to Liga's Heriberto Martínez as a courtesy, framed as *"we built this from your sector's published data; happy to have the methodology reviewed."* That framing is the whole game — see §4.1.

**Week 9 — Design partner close.** By this point you should have 3–6 institutions in active conversation. Convert two. The offer: a full pilot report at no cost, in exchange for a named testimonial, logo rights, and a 45-minute feedback session. Put it in writing on one page.

#### Q3 gate — pre-commit to this now

> **If Q3 ends with 0 signed design partners after eight weeks of full-effort outbound, the problem is the offer, not the volume.**
>
> Do not respond by sending more email. Stop outbound entirely for two weeks and run 15 Mom-Test discovery calls with no pitch and no deck. Find out what a Gerente de Finanzas would actually pay for. Then rebuild the offer. Scaling a broken offer in a 91-institution market is how you lose the market permanently.

---

### 3.3 Q4 2026 — **PRESUPUESTO 2027** (Oct 1 – Dec 31)

**Theme: the hardest deadline in this plan. Get into 2027 budgets before they lock in November.**

October is also **Mes del Cooperativismo** — statutory (Ley 491-2004), with a Governor's proclamation, a flag-raising at Liga, and island-wide local events. Sector attention is at its annual peak. It is the single best month of the year to be visible, and it lands exactly on the budget cycle. This alignment is the reason Q4'26 is the highest-leverage quarter in the plan.

#### Objectives

| # | Objective | Target |
|---|---|---|
| 1 | **Institutions with CerniQ in the 2027 budget** | **15** (tracked explicitly per account) |
| 2 | Paying accounts | 4 |
| 3 | First case study published (ES + EN, video + PDF) | 1 |
| 4 | **PR Cooperativista article published** — October issue | 1 |
| 5 | Video assets | 18 (~1.5/week, with an editor) |
| 6 | Índice CerniQ edition 2 (Q3-2026 data, ~mid-December) | 1 |
| 7 | CPA firms in conversation | 5 |
| 8 | CENASE seminar proposal submitted | 1 |

#### Where the leverage is

**The budget conversation is a different conversation.** It is not "do you want this." It is *"what line item does this sit under, who has to approve it, and what does the Junta need to see?"* Every Tier 0/1 account gets that question directly in October. Half of them will not know, and helping them figure it out is how you become the internal champion's ally rather than another vendor.

**Give them the artifact that gets it approved.** Build a one-page, bilingual **"Justificación de Presupuesto 2027"** template: the current cost of manual/consultant ALM reporting, the CerniQ cost, the regulatory context (NASCUS accreditation, rising exam standards, RAP→GAAP, FHLBNY), and the risk of not acting. Your champion presents it to their board. You never appear. This single asset is worth more than another quarter of cold email.

**PR Cooperativista, October issue.** Quarterly (Jan/Apr/Jul/Oct), 24 pages full color, **40,000 copies**, distributed through the cooperativas *and inserted into Primera Hora* at 99 intersections island-wide. Contact: Grace M. Matos, `coordinacion@liga.coop`. **Do not buy an ad first — pitch an article.** A plain-language explainer on what FHLBNY membership does to a cooperativa's balance sheet is genuinely useful to that readership and Liga's editorial need is real. Get the rate card in the same email for later use. Editorial deadlines are unpublished — assume materials due 4–6 weeks pre-issue and **email in Week 1 of this plan, not October.**

**Case study.** The moment design partner #1 completes a real report cycle, produce it in three formats: a 3-minute video (F5), a 2-page bilingual PDF, and a LinkedIn post. Lead with the number that matters to a CFO — hours, or dollars, or the examiner's reaction. Not features.

#### Q4 gate

> **If Q4 ends with fewer than 3 paying accounts and zero confirmed 2027 budget line items, the price or the buying process is wrong.**
> Q1'27 pivots: make the **CPA channel the primary motion** rather than the secondary one. A firm like González Torres & Co. already has budget authority inside multiple cooperativas and doesn't need one created.

---

### 3.4 Q1 2027 — **CONVENCIÓN** (Jan 1 – Mar 31)

**Theme: cash the budget line items, and show up at the one event that matters.**

**ASEC Convención Nacional — late March, Ponce Hilton.** This is the highest-density gathering of cooperativa executive presidents in Puerto Rico. Vendor booths are sold (10'×8'; registration historically $595–650). Contact: Dahlia Torres Valentín, `dtorres@ejecutivos.coop`. ASEC also maintains an *Oportunidades de mercadeo* page for sponsors.

**Do not attend in 2026 with nothing.** Attend in March 2027 carrying: 4+ paying customers, two published Índice editions, a PR Cooperativista byline, a case study, and — ideally — a customer willing to appear with you. That combination turns a booth from a cost into a credential.

#### Objectives

| # | Objective | Target |
|---|---|---|
| 1 | Paying accounts (cumulative) | 9 |
| 2 | ASEC Convención — booth + speaking proposal submitted | Booth confirmed; speaking = stretch |
| 3 | Signed CPA partner agreements | 2 |
| 4 | Índice CerniQ edition 3 (Q4-2026 annual data, ~mid-March) | 1 — the annual edition; make it the best one |
| 5 | Customers presenting alongside you (convention or webinar) | 1 |
| 6 | Video assets | 26 (2/week) |
| 7 | FHLBNY cohort engagement | Every confirmed applicant/member contacted |

**The annual Índice matters most.** The Q4/December COSSEC data is the annual picture and it gets the most press coverage of the year. Time edition 3 to it, make it the flagship, and pitch it directly to sector journalists a week ahead of publication.

---

### 3.5 Q2 2027 — **CANAL** (Apr 1 – Jun 30)

**Theme: stop being the only person who can sell CerniQ.**

A solo founder tops out. The exit from that ceiling is other people's distribution: CPA firms, Liga's education arm, and the regional Consejos.

#### Objectives

| # | Objective | Target |
|---|---|---|
| 1 | Paying accounts (cumulative) | 16 |
| 2 | **CENASE seminar delivered** (Liga education arm) | 1–2 |
| 3 | CPA white-label deployment live | 1 firm, 3+ institutions |
| 4 | Consejo Regional presentations | 2 (Norte and Oeste first) |
| 5 | Índice edition 4 (Q1-2027, ~mid-June) | 1 |
| 6 | Inbound leads (no outbound touch) | 5 |
| 7 | First hire or long-term contractor | 1 |

**CENASE is the highest-trust position available in this movement.** It is Liga's education arm, with a seminar catalog for cooperativa staff and boards. Contact: Lissette Estevez, `educacion@liga.coop`. The pitch is a **free** board-education seminar — *"Riesgo de tasa de interés para juntas de directores"* — that teaches a volunteer board how to read an ALM report. Not how to buy one. Board education is the one thing no vendor sells against, it makes you the sector's teacher rather than its supplier, and it puts you in a room with the exact people who approve budgets.

**Consejos Regionales are underrated and perfect for a solo founder.** Six of them — Metropolitano, Metro Norte, Norte, Oeste, Sur Central, Este. Smaller rooms, real conversations, near-zero cost, and they map to the asset concentration: Caguas $3,311M, Arecibo $3,004M, Mayagüez $2,182M. Two well-run regional presentations beat one convention booth for a founder who has to talk to everyone personally.

---

### 3.6 Q3 2027 — **SISTEMA** (Jul 1 – Sep 30)

**Theme: move from vendor to infrastructure, and deal with Banco Cooperativo from strength.**

#### Objectives

| # | Objective | Target |
|---|---|---|
| 1 | Paying accounts (cumulative) | 24 |
| 2 | **Core-system adapters shipped** | Fiserv DNA + Sharetec + generic CSV |
| 3 | AITSA-aligned output capability | Working draft; COSSEC technical contact established |
| 4 | **Banco Cooperativo (BanCoop) conversation opened** | Meeting with CEO Johnny A. Pérez-Crespo |
| 5 | Índice edition 5 | 1 |
| 6 | Net revenue retention | >100% (expansion within accounts) |
| 7 | Second market validated (research only) | 1 written thesis |

**Adapters are the retention moat.** As long as CerniQ runs on manual CSV upload, switching cost is near zero. Once you pull directly from Fiserv DNA's Oracle database (Fiserv's AppMarket even sells a purpose-built *ALM-CECL Extract* app producing instrument-level CSVs) or from Sharetec, you are wired into the institution's operations. Confirmed on-island: 4 cooperativas on Fiserv DNA via the USICOOP CUSO, 4+ on Sharetec (fastest-growing), zero confirmed Symitar, and a long tail on local/legacy systems — which is why the generic CSV adapter stays first-class forever.

**BanCoop: the most consequential relationship in the plan, and the biggest threat.** Banco Cooperativo is the sector's correspondent bank, ~51 employees, and **is developing shared digital/core technology for cooperativas**. If they add ALM, they have distribution you cannot match. Approach in Q3'27, not earlier — with 24 institutions live, you're a partner. With zero, you're a feature request. The framing when you go: *integration*, not competition.

**COSSEC: approach as a data contributor, never as a vendor.** By Q3'27 you'll have five published Índice editions built on their data. The ask is *"would your team review the methodology before the next edition?"* — respectful, low-risk, and it establishes you as serious. **Never claim or imply COSSEC endorsement.** Re-verify leadership (Mabel Jiménez Miranda, Presidenta Ejecutiva as of the last confirmed source) before any contact.

---

### 3.7 Q4 2027 — **EXPANSIÓN** (Oct 1 – Dec 31)

**Theme: run the 2028 budget cycle as an incumbent, and open the next market.**

#### Objectives

| # | Objective | Target |
|---|---|---|
| 1 | Paying accounts (cumulative) | 34 base / 45 stretch |
| 2 | ARR run-rate | ~$450K base / ~$600K stretch |
| 3 | 2028 renewals + expansions confirmed | >90% of eligible |
| 4 | **Adjacent market: first 3 conversations** | 3 |
| 5 | Índice edition 6 + annual sector report | 1 |
| 6 | Team | 2–3 people |

#### The adjacent market — where CerniQ goes after Puerto Rico

Puerto Rico is a 60-institution beachhead. It is a defensible one, and it will not be a $10M business. The expansion thesis is that **bilingual, Spanish-first ALM with regulator-specific output** is a structurally underserved category well beyond PR:

- **US mainland Hispanic-serving credit unions** — several hundred CDFI/MDI credit unions with Spanish-dominant memberships and bilingual boards. They're NCUA-regulated (different output, same language gap), and Inclusiv — already active in PR cooperativa financing — is the natural bridge network.
- **Latin American cooperativa federations** — Ecuador's SEPS-segmented cooperativas (~250+ under strict liquidity/ALM reporting), Mexico's CNBV-regulated SOCAPs, Colombia's supervised cooperative financial sector, Costa Rica. Combined, a multi-thousand-institution Spanish-language TAM where the entire mainland vendor set is monolingual English.
- **PR IBEs and community banks** — already supported types in the codebase; different regulator (OCIF), same math.

**Q4'27 does research and three conversations. It does not enter.** Entering a second market before the first is fully won is the most common way a beachhead business dies. The gate for actually entering is: >30 PR accounts, >90% retention, and a second person capable of running the PR motion without you.

---

## 4. The Liga Cooperativa entry — a four-quarter ladder

You are cold. This section is the answer to "how do I get in the door with Liga across the board."

### 4.0 The mistake to avoid

**Do not ask Liga for an endorsement, a directory listing, a member discount, or a preferred-vendor slot as your first contact.** Liga is a third-degree movement institution founded in 1948 *by the cooperativas themselves*. Its function is to protect and represent the sector. A software vendor with zero customers requesting access reads as extraction, and — critically — the answer will be a polite no that is very hard to reverse. You get roughly one first impression with an institution like this.

**The ladder is: contribute → get cited → get invited → get endorsed.** Four rungs, four quarters. Each rung makes the next one an easy yes.

### 4.1 Rung 1 (Q3'26) — Become a data source: **El Índice CerniQ**

This is the Trojan horse, and it is the most important single tactic in this document.

**What it is.** A free, public, quarterly analysis of interest-rate risk across the Puerto Rico cooperative system, built entirely from COSSEC's published quarterly data, with a fully documented methodology. Published as a bilingual PDF + a landing page + a 90-second video (format F2) within **7 days of each COSSEC statistical PDF release** (~75 days after quarter close: mid-March, mid-June, mid-September, mid-December).

**Why it works, mechanically:**

1. **Nobody does it.** Estudios Técnicos publishes the ETI stability index. Nobody publishes a *rate-risk* index. The white space is real and it is exactly your competence.
2. **It makes you citable.** NotiCel, El Vocero, Sin Comillas, Semanario Visión and Primera Hora all cover COSSEC's quarterly data on release. They need an analytical angle and a quotable source. If you publish 7 days after the data drops with a clean chart and a clear finding, you become that source. Earned media in this sector is worth more than any ad.
3. **It changes what you are to Liga.** You stop being a vendor asking for something and become an analyst contributing something. That is the only posture from which the later asks work.
4. **It is the perfect recurring outbound hook.** Every edition is a legitimate, welcome reason to contact all 91 institutions — including the ones who said no. Four zero-risk touches per year, forever.
5. **It compounds.** By edition six you own a time series nobody else has, and the index becomes the reference.

**Rules that make it credible:**
- Publish the methodology in full. Show your assumptions. Mark estimates as estimates.
- Never name an underperforming institution. Report distributions, quartiles, and regional aggregates. Naming a struggling coop would end your access to the sector overnight.
- Never put a CTA in it. No "book a demo." The credibility *is* the conversion mechanism.
- Send it to Heriberto Martínez (`ejecutivo@liga.coop`) and to COSSEC as a courtesy before or at publication, framed as *"built from your sector's published data — happy to have the methodology reviewed."*

### 4.2 Rung 2 (Q3–Q4'26) — **Puerto Rico Cooperativista**

Liga's newspaper since 1963. Quarterly (Jan/Apr/Jul/Oct), 24 pages full color, **40,000 copies**, distributed through the cooperativas *and inserted in Primera Hora* island-wide.

**Contact:** Grace M. Matos — `coordinacion@liga.coop`.

**The ask, in this order:** (1) contribute an article to the October *Mes del Cooperativismo* issue on what FHLBNY membership means for a cooperativa's balance sheet — genuinely useful, non-promotional, and topical; (2) in the same email, request the advertising rate card and editorial calendar for later. Editorial deadlines are not published — assume 4–6 weeks lead and **send this email in Week 1**, not in September.

A byline in PR Cooperativista is the cheapest institutional credibility available in this market.

### 4.3 Rung 3 (Q4'26 → Q2'27) — **CENASE**, the education arm

**Contact:** Lissette Estevez, Gerente de Programas Educativos, Informáticos e Investigativos — `educacion@liga.coop`. She is the education and technology gatekeeper.

**The ask:** a free seminar for the CENASE catalog — *"Riesgo de tasa de interés para juntas de directores: cómo leer un informe ALM."* Teach volunteer board members to read the report. Do not teach them to buy software.

Submit the proposal in Q4'26. Deliver in Q2'27. This is the highest-trust rung on the ladder: it puts you in a room, as the teacher, with the exact volunteers who approve budgets — and it is the one position no competitor can attack, because attacking free board education looks terrible.

### 4.4 Rung 4 (Q1'27) — **ASEC**: the executives' association

ASEC (Asociación de Ejecutivos de Cooperativas, founded 1973) is the **best channel to CEOs**, distinct from Liga.

- **Dirección Ejecutiva:** Dahlia Torres Valentín — `dtorres@ejecutivos.coop`
- **Presidente:** Carlos F. Ortiz Díaz (BoniCoop) · **VP:** William Méndez Pagán (Coop Oriental)
- **Convención Nacional:** late March, Ponce Hilton, vendor booths available
- **Seminario Residencial:** ~August annually — **verify the 2026 date immediately; it may be within weeks**
- **Socios directory** (`ejecutivos.coop/socios`) — the best CEO-layer contact source in the market
- An *Oportunidades de mercadeo* page exists for sponsorship

**Week 1 action:** email Dahlia Torres requesting the 2026 Seminario Residencial date, the 2027 Convención date, and the marketing/booth rate card. Pure information request — no pitch. It costs nothing and the answer shapes two quarters of planning.

### 4.5 Rung 5 (Q2–Q3'27) — Liga's Comisión de Ahorro y Crédito, and the Consejos

- **Gerardo Matos Ayala** sits on Liga's Junta de Directores for the **Comisión de Ahorro y Crédito** — the single most relevant board seat for CerniQ. By Q2'27, with an index, a byline, a CENASE seminar, and named customers, the ask is simply *"may I present the Índice to the Comisión?"*
- **Six Consejos Regionales** (Metropolitano, Metro Norte, Norte, Oeste, Sur Central, Este) hold their own conferences. Prioritize **Norte** (Arecibo region, $3,004M) and **Oeste** (Rincón/Isabela/Mayagüez/Cabo Rojo). Cadence is unpublished — ask Liga directly.

### 4.6 Rung 6 (Q3–Q4'27) — Institutional relationships, approached from strength

| Entity | Person | Timing | The ask |
|---|---|---|---|
| **Liga** | Heriberto Martínez Otero, Director Ejecutivo | Q3'27 | Formal affinity/preferred-vendor arrangement |
| **Banco Cooperativo** | Johnny A. Pérez-Crespo, CEO | Q3'27 | Integration partnership with their shared-technology initiative |
| **COSSEC** | Mabel Jiménez Miranda, Presidenta Ejecutiva *(re-verify)* | Q3'27 | Methodology review; AITSA technical specification |
| **Circuito Cooperativo** | Kerwin Morales, board president (Coop Cabo Rojo) | Q4'27 | 50+ coops, ~950k members — shared-service distribution |
| **FIDECOOP** | — | Q4'27 | Movement investment fund; financing angle for member coops |
| **FHLBNY** | Alexies Sornoza, VP Member Relations | Q1'27 | Referral relationship for cooperativa applicants |
| **Inclusiv** | — | Q1'27 | Already financing PR cooperativa mortgages; national CDFI bridge |

**Sequencing rule: never approach an institutional body before you have institutional proof.** Each of these is a one-shot conversation. Spend them when you have customers.

### 4.7 The CPA channel — parallel, and possibly the real answer

Every cooperativa's auditor is a potential distributor. COSSEC Circular CC-09-02 mandates audit-staff rotation, which means firms rotate through institutions and carry practices with them.

| Firm | Why | Priority |
|---|---|---|
| **González Torres & Co. CPA** | Explicitly specializes in cooperativas; partners present publicly on the COSSEC fiscal plan | **Highest — partner or competitor** |
| **Galíndez LLC** | Top-10 PR firm; speaks at ASEC conventions | High |
| **Aquino, De Córdova LLC** | Lists cooperativas as a served industry | Medium |
| **Kevane Grant Thornton** | Documented CECL expertise | Medium |
| **Estudios Técnicos** | Built the ETI stability index — analytics competitor *and* possible partner | Watch closely |

Open this in Q4'26, sign in Q1'27, go live in Q2'27. **If the direct motion underperforms through Q4'26, promote this to the primary channel** — a firm auditing eight cooperativas has budget authority and standing that you, cold, do not.

---

## 5. The video content engine

### 5.1 The governing idea: produce evidence, not content

Your buyer is a Gerente de Finanzas at a $200M cooperativa who has been quoted $15,000 for a report that takes three weeks. That person is not persuaded by thought leadership. They are persuaded by **watching the thing work.**

This is why 80% faceless is the right ratio and not a compromise. The highest-converting video asset available to you is a screen recording of a CSV becoming a 14-page bilingual COSSEC-format PDF in under five minutes. It requires no face, no charisma, and no studio — and it is more persuasive than anything you could say to camera.

**Spanish is primary in every asset.** English subtitles where useful. Every cooperativa board meeting, every COSSEC filing, and every asamblea happens in Spanish.

### 5.2 The five formats

#### F1 — **"El Informe en 4 Minutos"** · faceless · flagship
Real-time screen capture: CSV in → bilingual board-ready PDF out. No cuts during the compute — the honesty of the unbroken take *is* the proof. Spanish voiceover explaining what each metric means as it renders.
**Cadence:** 1 per quarter, refreshed with current data. **Length:** 4–6 min.
**Role:** pinned everywhere. The asset you link when someone asks "what does it do." This replaces a demo call for half your prospects.

#### F2 — **"Termómetro del Sistema"** · faceless · the recurring hook
90-second animated walkthrough of the sector's quarterly numbers, published within 7 days of each COSSEC statistical PDF. Capital, morosidad, loan mix, yields, regional splits. This is the **video companion to El Índice CerniQ** (§4.1) — same data, same publication moment.
**Cadence:** 4/year (quarterly), plus optional monthly mini-cuts using BLS/FRED/PR-EAI data, which publish monthly.
**Role:** the forwardable asset. This is what gets shared in a WhatsApp group of finance managers.

#### F3 — **"Pizarra ALM"** · faceless · the education engine
3–6 minute explainers, one concept each, screen/animation only:
`brecha de duración` · `EVE / NEV` · `choques de tasa ±300bps` · `LCR y activos líquidos de alta calidad` · `CECL vs. pérdida incurrida (Regl. 8665)` · `RAP vs. GAAP: qué cambia en 2028` · `el triple CAEL, explicado` · `qué le hace un adelanto del FHLBNY a su balance` · `cómo leer un informe ALM si usted es director voluntario`
**Cadence:** the workhorse — most of your volume.
**Role:** this is your CENASE seminar, atomized. It is what you send a CFO who says *"my board doesn't understand this."* It is also your entire SEO strategy (§5.5).

#### F4 — **"Cara a Cara"** · with face · ~20% · trust anchor
60–90 seconds, shot on a phone, near a window. Use your face only where a face genuinely helps:
- Founder intro — who you are, why you built this, once, pinned
- Reactions to sector news — a new law, a COSSEC circular, an FHLBNY milestone. These are timely, low-production, and high-signal.
- Customer-story intros
- Event and convention recaps
**Cadence:** ~1 in 5 assets.
**Role:** proves a human is behind the software. In a movement built on relationships, this is not optional — but it is not the bulk.

#### F5 — **"Caso Real"** · mixed · post-first-customer only
3-minute case study: the before (spreadsheet or consultant, three weeks), the after, a customer on record with a specific number.
**Do not produce until a design partner will go on record.** A fabricated or anonymized case study in a 91-institution market is transparent and fatal.

### 5.3 Production stack — solo, under $130/month

| Tool | Cost | Why this one |
|---|---|---|
| **Screen Studio** (macOS) | ~$89 one-time | Automatic cursor smoothing and zoom. Makes F1/F2/F3 look expensive for zero effort. Single highest-value purchase in this stack. |
| **Descript** | ~$24/mo | Transcript-based editing — you edit video by editing text. Filler-word removal, studio-sound cleanup, ES + EN subtitle generation and burn-in. The biggest time-saver available to a solo founder. |
| **CapCut** | Free | Vertical/square reframing and caption styling for LinkedIn, Instagram, and WhatsApp cuts. |
| **USB mic** (Fifine K669B / Samson Q2U) | ~$60–120 one-time | Audio quality is the only production variable viewers consciously notice. |
| Existing brand kit | — | Lower thirds, end cards. Do not redesign. |
| **Do not buy** | — | A camera, lights, a studio, or an animation subscription. You are 80% faceless. |

**Total: ~$24/mo recurring + ~$210 one-time.**

### 5.4 The production discipline that makes this survivable solo

**Batch. Never produce ad hoc.**

- **One "Día de Producción" per month.** Four hours, one sitting: record 6–8 assets back to back. Same shirt, same setup, same energy. Script beats are written the day before.
- **Edit in 45-minute blocks** across the following week. Descript makes a 4-minute explainer roughly a 30-minute edit once you have a template.
- **The only exception is F4 news reactions** — those are shot same-day on a phone and published within 24 hours, because their value is timeliness.
- **Maintain a script bank.** Every objection you hear on a call becomes an F3 script. Every Índice finding becomes an F2. You will never run out of topics if you write them down when they happen.

**Realistic cadence given solo capacity:**

| Quarter | Assets | Rate | Note |
|---|---|---|---|
| Q3'26 | 8 | ~1/wk | Solo. F1 ×1, F2 ×1, F3 ×4, F4 ×2. |
| Q4'26 | 18 | ~1.5/wk | Hire the editor. |
| Q1'27+ | 26/qtr | 2/wk | Sustainable with an editor. |

Do not plan for more than 1/week while you are alone. A missed cadence is worse than a slower one.

### 5.5 Distribution — where most content plans fail

Producing the asset is 40% of the work. These five surfaces are the other 60%.

**LinkedIn — primary public surface.**
Native upload only; never post a YouTube link (the algorithm suppresses off-platform links). Spanish caption. First line is the hook and must survive truncation. Any link goes in the first comment. Post Tue/Wed/Thu, 7:30–8:30 AM AST — before the workday, when PR executives check their phones.

**WhatsApp — the channel your current playbook is missing, and the one that actually converts.**
WhatsApp is the dominant business communication channel in Puerto Rico. A Gerente de Finanzas forwarding your 90-second explainer into an ALCO group chat is worth more than 500 LinkedIn impressions, because it arrives with an implicit endorsement.

**Design for the forward:** every asset needs a **<25 MB, vertical or square, subtitles-burned-in** variant. Assume it will be watched on mute, on a phone, in a meeting. If it doesn't work silent and vertical, it doesn't get forwarded.

Never cold-broadcast on WhatsApp. See §7.3.

**YouTube — permanence and citability, not reach.**
You will not build a YouTube audience in this niche and you shouldn't try. YouTube's job is to be the durable, linkable home for every explainer so you can drop a specific URL into an email — and to be what a CFO finds when they google you after your email lands. Organize into playlists by topic. Spanish titles, Spanish descriptions.

**Email — every video is a sequence asset.**
A 90-second video link in a follow-up materially outperforms another paragraph of text. Touch 3 of the cold sequence (§6.7) is a video, not a pitch.

**The website — the compounding surface nobody is contesting.**
Build `/recursos` as the video library. Then, the genuinely free opportunity: **nobody on earth is competing for the Spanish-language search terms in this category.** `brecha de duración cooperativa` · `riesgo de tasa de interés COSSEC` · `informe ALM cooperativa Puerto Rico` · `CAEL cooperativa` · `qué es EVE riesgo tasa` · `FHLBNY cooperativa Puerto Rico requisitos`. Zero commercial competition. Every F3 explainer becomes a transcript-derived article page. Over six quarters this becomes an inbound channel that costs nothing beyond the video you already made.

---

## 6. Cold email infrastructure — full build

### 6.1 The counter-intuitive frame

You are about to build enterprise-grade sending infrastructure in order to send **about 20 emails a day.**

That is correct, and it is the entire point. Your total addressable contact list is ~350 people. At 20/day you exhaust the whole market in roughly 18 business days. **Sending capacity is not your constraint — list size is.** The infrastructure exists to guarantee that those 20 emails land in the inbox of the 20 people who matter most on the island, not to enable 2,000 emails to people who don't.

Read every decision below through that lens. Where volume-optimized advice conflicts with reputation-optimized advice, take reputation.

### 6.2 Architecture — strict three-lane separation

| Lane | Domain | Provider | Purpose | Volume |
|---|---|---|---|---|
| **Transactional** | `cerniq.io` | Resend *(already configured — leave it alone)* | Report ready, portal links, invoices, password resets | Product-driven |
| **Human / 1:1** | `cerniq.io` → `erwin@` | Google Workspace | Replies, warm threads, Tier 0 outreach, contracts | Low, manual |
| **Cold outbound** | 2–3 **secondary** domains | Google Workspace mailboxes → Instantly | First-touch prospecting only | 15–25/day total |

**Two rules that make this work:**

1. **The moment a prospect replies, the conversation moves to `erwin@cerniq.io`.** You want your real domain in the real thread, on the real signature, with the real company behind it. The cold domain is for first contact only.
2. **Tier 0 (top 15 institutions) never touches the cold infrastructure at all.** Fifteen hand-written emails from `erwin@cerniq.io`. Those accounts are worth more than the efficiency.

**On the tradeoff, honestly:** some deliverability practitioners argue that for very low volume, high-value outbound like this, sending from a well-warmed primary domain gets *better* placement — real domain age, real website, real history. That view has merit. Two things tip it the other way here: the Resend acceptable-use collision, and the fact that in a 91-institution market a single spam complaint against `cerniq.io` can degrade delivery to a paying customer. Take the separation.

### 6.3 Domains

Buy **2–3** now — they need 3–4 weeks of age before serious sending.

**Rules:** must read like a real company; 301-redirect to `cerniq.io` so a curious CFO lands somewhere real; no hyphens, no numbers, no novelty TLDs.

**Candidates, best first:** `cerniqpr.com` (reads local, which matters here) · `usecerniq.com` · `cerniq.app` · `cerniqanalytics.com`

Put a real 301 on each on day one. An empty domain is a spam signal.

### 6.4 DNS — exact configuration, per sending domain

**1. MX** — Google Workspace, current simplified record:
```
MX   @   1   SMTP.GOOGLE.COM
```
*(The legacy 5-record ASPMX set still works if already in place.)*

**2. SPF** — exactly **one** TXT record on root, under 10 DNS lookups:
```
TXT  @   v=spf1 include:_spf.google.com ~all
```
> **The detail people get wrong:** Instantly/Smartlead connect *to* your Google mailbox over SMTP/OAuth — the mail still originates from Google's servers. **Do not add your sequencer to SPF.** Adding it is a common, silent misconfiguration.

**3. DKIM** — Google Workspace, 2048-bit:
- Admin Console → Apps → Google Workspace → Gmail → **Authenticate email** → Generate new record (2048-bit)
- Publish TXT at `google._domainkey`
- **Then click "Start authentication."** Generating the key does not enable signing. This is the single most-forgotten step in Google Workspace DKIM setup and it silently produces unsigned mail.

**4. DMARC** — TXT at `_dmarc`:
```
v=DMARC1; p=none; rua=mailto:<your-postmark-aggregator-address>; fo=1; adkim=r; aspf=r
```
- Start at `p=none`. After 2–3 weeks of clean aggregate reports → `p=quarantine; pct=100`.
- **Terminal state for cold domains is `quarantine`, not `reject`** — you may add senders later and `reject` will silently kill them.
- `cerniq.io` can go to `p=reject` once Resend and Google are both confirmed aligned. Note your existing record uses strict alignment (`adkim=s; aspf=s`) — correct for a locked-down transactional domain, but it *will* break the first time you add a sender and forget.
- Your `ops/dmarc_inbox_setup.md` already documents the Postmark DNS Monitoring aggregator (free). Use it for all domains.

**5. Tracking domain — recommendation: don't need one, because turn tracking off.**
Open-tracking pixels are a well-known spam signal in 2026, and the data has been meaningless since Apple Mail Privacy Protection inflates opens with pre-fetches. **Track replies, not opens.** Turning tracking off improves deliverability, removes the need for a custom tracking CNAME, and removes a category of misleading metrics. If you must know whether the Pre-Informe was read, host it as a plain PDF URL and read your own server logs.

**6. MTA-STS + TLS-RPT** — worth adding on `cerniq.io`. Skip on cold domains.

**7. BIMI** — skip. Requires a VMC certificate (~$1,000+/yr) and enforced DMARC. Not a Q3'26 problem.

### 6.5 Mailboxes and warmup

**Mailboxes:** 2 per domain × 3 domains = **6**. Google Workspace Business Starter ≈ $7.20/user/mo ≈ **$43/mo.**

Name them like humans: `erwin@cerniqpr.com`, `e.kiess@cerniqpr.com`, `ekiess@usecerniq.com`. **Never** `sales@`, `info@`, `hello@`, `team@` — role addresses get filtered aggressively and get near-zero replies.

Each mailbox needs: a real profile photo, a real name, a two-line signature, and a footer with a physical San Juan address. The address is a CAN-SPAM requirement *and* a trust signal to a regulated buyer.

**Warmup schedule:**

| Phase | Real sends/day/mailbox | Warmup tool | Note |
|---|---|---|---|
| Weeks 1–2 | **0** | 5 → 20/day, ramping | Warmup pool only. No real prospects. Non-negotiable. |
| Week 3 | 5 | continues | First real sends. Tier 1 only. |
| Week 4 | 10 | continues | |
| Week 5+ | **15 (hard cap)** | continues **permanently** | Never turn warmup off. |

Six mailboxes × 15 = 90/day theoretical ceiling. **You will deliberately send 15–25/day total.** The headroom exists so you never approach a limit, not so you can use it.

### 6.6 Sending tool and configuration

**Instantly.ai** (Growth, ~$37–47/mo) or **Smartlead** (~$39/mo). Instantly has the larger warmup pool; Smartlead has better API and sub-sequence logic. At solo scale, take Instantly for simplicity.

Configuration — these settings matter more than the tool choice:

- Connect all 6 mailboxes; **enable rotation**
- **Sending window: 8:00–11:30 AM and 1:30–4:00 PM AST, Monday–Thursday only.** Friday sends underperform in PR institutional culture.
- **Random delay 90–240 seconds** between sends
- **Daily cap: 15 per mailbox**
- **Open tracking: OFF. Link tracking: OFF.** (§6.4)
- **Stop-on-reply: ON**, across all campaigns
- **Plain text only.** No HTML template, no logo, no images, no button. A six-line plain-text email from a real person outperforms every designed template in institutional outbound, and it sidesteps the entire image/HTML spam-signal class.
- One campaign per tier. Never mix tiers in a campaign.

### 6.7 List building — where every data vendor will fail you

**Apollo, ZoomInfo, and Clay have thin-to-nonexistent coverage of Puerto Rico cooperativas.** Do not spend money there. Two weeks of manual work will produce a better list than anyone in this market has ever had — and that list is itself a durable asset.

**Source stack, in order of value:**

1. **COSSEC Anejo 9** — the quarterly statistical PDF. All 91 institutions with charter number, assets, members, employees, ranked. Parse once into your account table. This is the spine.
2. **Each cooperativa's own website** — nearly all publish `/junta-de-directores` and a `gerencia`/`nosotros` page with named executives and board members. Slow, manual, unbeatable.
3. **ASEC Socios directory** (`ejecutivos.coop/socios`) — best CEO-layer source.
4. **Liga Directorio** (`liga.coop/directorio`) — sector directory.
5. **LinkedIn Sales Navigator** ($99.99/mo) — partial coverage, but confirms who is current and surfaces titles.
6. **Informes Anuales** — most coops publish them; they name ALCO and Comité de Riesgo members.
7. **Sector press** — NotiCel, El Vocero, Sin Comillas, Semanario Visión, Primera Hora — for appointments and trigger events.

**Email pattern derivation.** Most cooperativas use predictable patterns on their own domain. Derive `nombre.apellido@`, `ninicial+apellido@`, `napellido@`, then verify.

**Verification is mandatory, not optional.** MillionVerifier (~$29 / 10k credits) or ZeroBounce. **Bounce rate must stay under 2%** — that is now an enforced threshold at Google, Yahoo, and Microsoft, not a guideline. Send only to addresses marked *valid*. **Never send catch-all/accept-all addresses from a cold mailbox** — route those to the LinkedIn or phone lane instead.

**Target list shape:**

| Segment | Institutions | Contacts | Treatment |
|---|---|---|---|
| **Tier 0** — top 15 by assets | 15 | ~60 | **Never sequenced.** Hand-written from `erwin@cerniq.io`. |
| **Tier 1** — $100–500M | 25 | ~90 | Sequenced, per-institution personalization token from real COSSEC data |
| **Tier 2** — $50–100M | 20 | ~60 | Standard sequence |
| **Tier 3** — <$50M | 31 | ~60 | **Nurture only.** Índice + video. No sequence. |
| CPA firms | 15–20 | ~40 | Separate sequence, Q4'26 |
| Ecosystem | ~10 orgs | ~25 | Manual, individual, never sequenced |

Roles per institution: Presidente Ejecutivo · Gerente de Finanzas · Gerente de Riesgo/Cumplimiento · Presidente de Junta · Tesorero.

**Why Tier 3 gets nurture only:** they cannot afford the product today, and the sector is consolidating (111 institutions in 2021 → 91 today). Today's $30M cooperativa is next year's merger into a Tier 1 account. Burning them costs you future customers for zero present gain.

### 6.8 The sequence — 4 touches, 18 days, Spanish primary

Design rules: **the Pre-Informe is the payload, not the pitch.** No attachment on touch 1 (attachments on cold first-contact are a spam signal). Five to eight lines maximum. One specific number from *their* public data in every email. No adjectives about your software.

| # | Day | Subject | Body shape |
|---|---|---|---|
| **E1** | 0 | `Análisis de [Cooperativa] — datos COSSEC Q2 2026` | Name one specific figure from their Anejo 9 row. State what you built from public data. Offer to send it. No link, no attachment, no calendar. |
| **E2** | 4 | *(reply in thread)* | One line + the FHLBNY angle if they hold mortgages. Link to the hosted Pre-Informe. |
| **E3** | 11 | *(new thread)* | The 90-second F3 explainer most relevant to their situation. **No ask.** Pure value. |
| **E4** | 18 | *(reply in thread)* | Breakup, one line: *"Cierro el hilo. Si en algún momento el comité ALCO necesita esto, aquí estoy."* |

Then: **60-day silence**, then the account moves into the quarterly Índice nurture list. **Never re-sequence a non-responder within the same quarter.**

Write E1–E4 in Spanish first, then delete every sentence that sounds like software marketing. If a sentence could appear in any SaaS email, cut it. What survives should read like a competent analyst who did homework — because that's exactly what it is.

### 6.9 Compliance

Puerto Rico is US jurisdiction, so **CAN-SPAM applies**: accurate From and Subject lines, a valid physical postal address in every email, a functioning opt-out honored within 10 business days.

Add **`List-Unsubscribe` and `List-Unsubscribe-Post`** headers (RFC 8058, one-click). Your sequencer does this — verify it is enabled. As of 2026 this is enforced by Google, Yahoo, and Microsoft, not advisory.

GDPR does not apply to US recipients. It will the day you email a Latin American federation.

### 6.10 Monitoring — 10 minutes, every Monday

| Check | Tool | Threshold |
|---|---|---|
| Spam complaint rate | **Google Postmaster Tools** (add all domains) | <0.1% target · **0.3% is the enforced ceiling** |
| Microsoft reputation | **SNDS** + **JMRP** (enroll — Microsoft is harshest and gives no other feedback) | No red |
| Authentication alignment | Postmark DNS Monitoring (DMARC aggregator) | 100% pass |
| Blacklists | MXToolbox, all domains | Clean |
| Bounce rate | Sequencer | **<2%** |
| **Reply rate** | Sequencer | **8–15%** — the only metric that means anything |

### 6.11 Kill switches — commit to these before you send anything

| Trigger | Action |
|---|---|
| Bounce rate >3% on any mailbox | Pause that mailbox. Re-verify the entire list segment. |
| Spam complaints >0.1% | **Pause all cold sending.** Audit copy before resuming. |
| **Any single spam complaint from a Tier 0 or Tier 1 account** | Pause that account permanently from email. Switch to LinkedIn/phone/in-person only. Log it in the account plan. |
| 2+ complaints from named accounts in a quarter | Shut down cold email entirely. Go pure content + channel + field. |

In a 91-institution market a spam complaint is a **relationship event**, not a metric. Treat it like one.

---

## 7. The DM system — around the clock, done correctly

### 7.1 The reframe

**"DMing around the clock" as a volume strategy will end this business.** §1.2 has the mechanism: 91 institutions, ~350 people, a professional network that meets in six regional councils and shares a board. Three hundred templated DMs produce roughly thirty peer conversations about you inside a week, and you do not control what gets said.

**But the instinct behind the question is right.** This market rewards relentless effort. The correction is not *work less* — it is **apply the effort to a different verb.**

Here is where a genuine 12-hour day goes:

| Activity | Daily volume | Risk | Compounding |
|---|---|---|---|
| **Account research** — annual reports, board pages, trigger scanning | 2–3 hrs | Zero | High |
| **Asset production** — Pre-Informes, video, the Índice | 2–3 hrs | Zero | Very high |
| **Public engagement** — substantive comments on posts by cooperativa execs, Liga, ASEC, COSSEC, sector journalists | **20–30 comments/day** | Zero | **Highest** |
| **Prepared outreach** — 5–10 DMs, each with 10+ minutes of preparation behind it | 1–2 hrs | Managed | High |
| Conversations — calls, demos, field visits | 2–3 hrs | Zero | Very high |

**Public commenting is the single most underrated activity available to you.** It is unlimited, it carries zero downside risk, it is visible to everyone in a small market, and it is how you become known *without asking anyone for anything*. Thirty thoughtful comments a day, sustained for a quarter, and cooperativa executives will recognize your name before your first email arrives. That is the round-the-clock work.

### 7.2 Channel caps and roles

| Channel | Daily cap | Role | Rules |
|---|---|---|---|
| **LinkedIn connection requests** | 15–20/day (≤100/wk) | Network build | **Never pitch in the note.** Above ~100/wk risks account restriction. |
| **LinkedIn comments** | 20–30/day | **Primary awareness engine** | Substantive only. Add a fact, a nuance, or a question. Never "Great post!" |
| **LinkedIn DMs (1st degree)** | 5–10/day | Warm follow-up only | Only to people who accepted *and* engaged with your content. |
| **LinkedIn InMail** (Sales Nav) | 3–5/month credits | Tier 0 CEOs only | Save credits for people you cannot otherwise reach. |
| **Cold email** | 15–25/day total | First touch at scale | Per §6. |
| **Phone** | 5–8 calls/day | Post-email, pre-demo | PR business culture is phone-friendly. Coops publish main numbers. Ask for the Gerente de Finanzas by name. |
| **WhatsApp** | **Permission only** | **Highest conversion, highest risk** | See §7.3. |
| **In person** | 1 field day/week | Tier 0 / Tier 1 | A visit to a $900M cooperativa outperforms 200 emails. |

### 7.3 WhatsApp — the channel your playbook is missing

WhatsApp is the dominant business communication channel in Puerto Rico, and it is entirely absent from `sales/OUTBOUND_PLAYBOOK.md`. It is also the fastest way to destroy a relationship if used wrong.

**Absolute rule: never cold-message on WhatsApp.** It reads as invasive to an institutional buyer, and WhatsApp bans prospecting behavior aggressively. Never use Business API broadcast lists for outbound.

**Earn the thread instead.** Once someone replies to email or takes a call, ask explicitly:

> *"¿Le sirve que le mande esto por WhatsApp? Es más rápido para coordinar."*

Almost everyone says yes. From that moment, WhatsApp becomes your highest-conversion channel: instant replies, scheduling in seconds, and — most importantly — it is where your video assets get **forwarded to the ALCO chair with an implicit endorsement**. That forward is the highest-value event in your entire funnel, and §5.5 is why every asset ships in a forwardable format.

Set up WhatsApp Business (free) with a proper profile and business hours. Use it for relationships, never for prospecting.

### 7.4 The multi-channel cadence — per Tier 1 account, 18 days

| Day | Action |
|---|---|
| 0 | Email 1 **+** LinkedIn connection request (neutral note or none) |
| 2 | Substantive LinkedIn comment on something they or their cooperativa posted |
| 4 | Email 2 — thread reply, Pre-Informe link |
| 7 | Phone call to the main number; ask for the Gerente de Finanzas |
| 9 | LinkedIn DM (only if connected) |
| 11 | Email 3 — the video, no ask |
| 14 | Second phone attempt, different time of day |
| 18 | Email 4 — breakup |
| 19–90 | Nurture only: Índice, video, sector news. No direct outreach. |

**Tier 0 variant:** replace emails 1 and 4 with hand-written messages from `erwin@cerniq.io`, drop emails 2 and 3, and add a field visit around day 10. Fifteen accounts, roughly one field day per week over four weeks.

### 7.5 Response handling — the discipline that actually converts

**Every reply gets a personal response within 2 hours during business hours, from `erwin@cerniq.io`.** Positive, negative, or "not now."

A "no thanks" gets a gracious one-liner and an offer to send the quarterly Índice. In a market this small, a well-handled no is a future yes and a plausible referral — and the person who handled it well gets talked about at the next Consejo meeting just as surely as the person who didn't.

Never argue with a no. Never send a "just following up" after a breakup email. Never re-add someone to a sequence after they've declined.

---

## 8. The named-account operating system

With 40 core accounts, this is not pipeline management. It is **account planning**, and it should look more like enterprise sales than SaaS growth.

### 8.1 One account plan per Tier 0/1 institution — 40 documents

Store in the existing `ProspectInstitution` table (already seeded with all institutions per Vol.5) with an Airtable or Notion view on top for daily work.

**Fields:**

| Group | Fields |
|---|---|
| **Firmographic** (from Anejo 9) | Charter #, assets, members, employees, region/Consejo, rank |
| **Qualification** | Mortgage book Y/N → **FHLBNY eligible**, core system, auditor, CAEL band if inferable |
| **People** | Presidente Ejecutivo, Gerente de Finanzas, Gerente de Riesgo, Presidente de Junta, Tesorero — name, title, email, LinkedIn, phone, confidence + last-verified date |
| **Context** | ASEC member?, recent press, asamblea date, known initiatives |
| **Engagement** | Every touch with date and channel; Pre-Informe generated Y/N; replies verbatim |
| **Commercial** | Stage, 2027 budget status, champion, blocker, next action + date |

### 8.2 Trigger events — the highest-converting outreach there is

Trigger-based outreach converts several times better than cold and carries **near-zero reputation risk**, because it is contextually welcome. Set Google Alerts and run a weekly 30-minute scan.

| Trigger | Signal source | Why it converts |
|---|---|---|
| **New CEO or CFO appointment** | El Vocero, NotiCel, Sin Comillas, coop press releases, LinkedIn | New executives audit vendors and want early wins. Highest-value trigger in the set. |
| **FHLBNY application or admission** | COSSEC, FHLBNY, Inclusiv, Sin Comillas | The wedge, made urgent and specific |
| **Merger or absorption** | COSSEC, sector press | Combined balance sheet must be re-modeled. Nobody has a model for it. |
| **New COSSEC carta circular** | `docs.pr.gov` COSSEC repository | Legitimate reason to contact all 91 at once |
| **Core system conversion** | Sharetec / Fiserv press releases | Data is already being moved — integration window is open |
| **Asamblea anual** | Coop websites, Liga | Agendas name strategic priorities for the year |
| **Any coop quoted on capital, liquidity, or rates** | Sector press | They just told you what keeps them up at night |

**Every trigger produces a same-week, personally written message.** These are the emails that get replies.

### 8.3 Weekly operating rhythm — solo

| Day | Focus |
|---|---|
| **Mon AM** | Deliverability + metrics review (§6.10, 10 min) · pipeline review · week's targets · trigger scan |
| **Mon–Thu AM** | Outreach blocks: sends, calls, LinkedIn engagement |
| **Mon–Thu PM** | Conversations, demos, follow-up, account plan updates |
| **Wed** | **Field day** — drive to a region, 3–4 branch visits |
| **Fri AM** | Content: editing, scripting, publishing |
| **Fri PM** | Research: account plans, Índice work, next week's personalization |
| **One day/month** | **Día de Producción** — batch-record 6–8 video assets |

---

## 9. Metrics, gates, and honest failure conditions

### 9.1 Leading indicators — track weekly, these predict revenue

| Metric | Q3'26 weekly target |
|---|---|
| Pre-Informes generated | 5 |
| Personalized emails sent | 75–100 |
| **Replies received** | 8–12 |
| Substantive LinkedIn comments | 100–150 |
| Conversations held (call/meeting/visit) | 3–5 |
| Video assets published | 1 |
| Account plans completed | 4 |

### 9.2 Lagging indicators — track monthly

Demos held · pilots started · **accounts signed** · MRR · **2027 budget line items confirmed** (the Q4'26 metric that matters most) · net revenue retention (from Q2'27)

### 9.3 The gates — pre-commit before you need them

| When | Condition | Action |
|---|---|---|
| **End Q3'26** | 0 design partners after 8 weeks | **Stop outbound for 2 weeks.** Run 15 Mom-Test discovery calls, no pitch. The offer is wrong, not the volume. |
| **End Q4'26** | <3 paying **and** 0 confirmed 2027 budget lines | Promote the **CPA channel to primary**. A firm auditing 8 coops already has the standing you lack. |
| **End Q1'27** | <8 accounts after ASEC + 2 Índice editions + a case study | The direct motion is not the model. Go channel-first: CPA white-label, BanCoop integration. |
| **Any quarter** | 2+ spam complaints from named accounts | **Shut down cold email entirely.** Content + channel + field only. |
| **Any quarter** | Founder working >65 hrs/wk for 6 consecutive weeks | Hire, or cut a workstream. Burnout is the single likeliest failure mode in this plan. |

### 9.4 What "on track" actually looks like

Not MRR. In Q3'26, on track means: **the Índice was published within 7 days of the COSSEC data, 40 Pre-Informes exist, and two institutions have said yes to a pilot.** Revenue is a Q4 output of Q3 inputs. Measuring Q3 on revenue will cause you to do the wrong things in Q3.

---

## 10. Budget and time

### 10.1 The tool stack — ~$270/month

| Item | Cost | Lane |
|---|---|---|
| Google Workspace × 6 mailboxes | $43/mo | Cold email |
| 3 domains | ~$3/mo amortized | Cold email |
| Instantly.ai (Growth) | ~$47/mo | Cold email |
| MillionVerifier | ~$29 one-time / 10k | List |
| LinkedIn Sales Navigator Core | $100/mo | DM + list |
| Descript | $24/mo | Video |
| Screen Studio | $89 one-time | Video |
| USB microphone | ~$90 one-time | Video |
| Postmark DNS Monitoring | Free | Deliverability |
| Google Postmaster / MS SNDS+JMRP | Free | Deliverability |
| CapCut | Free | Video |
| **Recurring total** | **~$217/mo** | |
| **One-time** | **~$210** | |

**Explicitly do not buy:** Clay ($149/mo — its PR coverage does not justify it against a manual list), Apollo/ZoomInfo (thin PR coverage), HubSpot paid tiers, a camera, an animation subscription, or a second sequencer.

### 10.2 The rest of the budget buys time, not tools

You have roughly **$780–1,780/month unallocated.** At a 91-institution TAM, more tools produce nothing. More hours produce everything.

| Priority | Spend | From | Buys back |
|---|---|---|---|
| **1. Video editor** (part-time, per-asset) | $300–500/mo | Q4'26 | ~15 hrs/mo — makes the 2/week cadence real |
| **2. Research VA** (Spanish-native, PR or LatAm, ~15 hrs/wk) | $400–600/mo | Q4'26 | ~30 hrs/mo — list building, account plans, trigger scanning, CRM hygiene |
| **3. ASEC Convención fund** | $300/mo sinking | Q3'26 | Booth + travel, March 2027 (est. $2,500–4,000) |
| **4. PR Cooperativista advertising** | $150/mo sinking | Q4'26 | Rate card unknown — request in Week 1 |
| 5. Field/travel | ~$150/mo | Q3'26 | Gas, tolls, coffee. The cheapest pipeline you will ever buy. |

**The research VA is the highest-ROI hire.** List building and account planning are the two activities most amenable to delegation and most destructive of founder hours.

### 10.3 Founder time allocation — 60 hr/week

| % | Hrs | Activity |
|---|---|---|
| **40%** | 24 | Outbound + conversations + field |
| **20%** | 12 | Content production |
| **15%** | 9 | Research + account plans |
| **15%** | 9 | Product — demos, report QA, custom requests. *The thing that closes deals.* |
| **10%** | 6 | Channel + ecosystem cultivation |

---

## 11. Risk register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Burning the TAM through volume outreach** | **Critical** | Tiered treatment; Tier 0 never sequenced; kill switches (§6.11); comment-first awareness (§7.1) |
| 2 | **Founder capacity collapse** | **Critical** | Strict quarterly sequencing — one new motion per quarter; hire the VA and editor at first revenue; the 65-hr gate (§9.3) |
| 3 | **The product has never met a real cooperativa extract** | **High** | At 0 customers, the CSV path is untested against production data. Scope design partner #1 as a **data engagement**; budget 2–3 weeks of engineering for the first real file. Do not promise same-day turnaround on file #1. |
| 4 | **BanCoop builds ALM into its shared technology** | **High** | They have distribution you cannot match. Reach them Q3'27 with an installed base, as a partner. Meanwhile deepen where a bank IT project won't go: bilingual board reporting, FHLBNY COL-121, the Índice. |
| 5 | **Regulatory whiplash** — Ley 99-2024 contested by FOMB; RAP→GAAP date unsettled | Medium | Never make a sale contingent on a date. Sell capability; cite deadlines as context. |
| 6 | **Missing the Nov 2026 budget window** | **High** | The Q4'26 "Justificación de Presupuesto" artifact (§3.3). Ask the budget question in October, not December. |
| 7 | **A mainland vendor adds Spanish** | Low near-term | The moat is **COSSEC/AITSA output**, not translation. Deepen regulatory-output depth, not language. |
| 8 | **Pricing inconsistency across public artifacts** | Medium | Fix in Week 1 (§2.3). Two prices in the wild is a credibility failure. |
| 9 | **Índice methodology challenged publicly** | Medium | Publish the methodology in full; mark estimates as estimates; offer COSSEC pre-review. Never name a weak institution. |
| 10 | **Sector consolidation shrinks the TAM** | Medium | 111 → 91 in five years. This *helps* — surviving institutions get larger and can afford more. Track merger activity as a trigger, not a threat. |

---

## 12. Week 1 — next seven days (Jul 27 – Aug 2, 2026)

Nothing in this plan matters if this week doesn't happen. Domains need 3–4 weeks of age before serious sending, which makes the DNS work the true critical path.

### Monday Jul 27 — decisions and letters
- [ ] Buy 3 domains (`cerniqpr.com` first); 301-redirect each to `cerniq.io`
- [ ] **Resolve the pricing inconsistency.** Pick one price list. Update `demo/PRICING_ONE_PAGER.md`, the website, and Stripe.
- [ ] Fix `pablo@cerniq.com` → `erwin@cerniq.io` in `demo/PRICING_ONE_PAGER.md`
- [ ] **Email Dahlia Torres** (`dtorres@ejecutivos.coop`): ASEC **Seminario Residencial 2026 date** *(~August — may be days away)*, Convención 2027 date, marketing/booth rate card. Information request only.
- [ ] **Email Grace M. Matos** (`coordinacion@liga.coop`): PR Cooperativista **October editorial deadline** + submission process + advertising rate card

### Tuesday Jul 28 — DNS (the critical path)
- [ ] Google Workspace: create 6 mailboxes across 3 domains, real names, photos, signatures, San Juan address in footer
- [ ] Publish MX, SPF, DKIM (**generate 2048-bit AND click "Start authentication"**), DMARC `p=none` on all 3 domains
- [ ] Point DMARC `rua` at the Postmark aggregator (per `ops/dmarc_inbox_setup.md`)
- [ ] Enroll all domains in **Google Postmaster Tools** and **Microsoft SNDS + JMRP**

### Wednesday Jul 29 — tooling and the account table
- [ ] Instantly: connect 6 mailboxes, **warmup only at 5/day**, all tracking OFF, 15/day cap configured
- [ ] Buy Screen Studio + Descript
- [ ] Download the latest COSSEC statistical PDF; **parse Anejo 9 into the account table** — 91 rows

### Thursday Jul 30 — the highest-ROI build in the plan
- [ ] **Build the Pre-Informe generator**: Anejo 9 row + sector aggregates → 4–6 page bilingual PDF (§2.2)
- [ ] Generate the first 5 (Rincón, COOPACA, CrediCentro, Las Piedras, Oriental)
- [ ] **QA them as if you were the CFO receiving one.** If you would not forward it to a peer, it is not ready.

### Friday Jul 31 — first assets
- [ ] Record **F1: "El Informe en 4 Minutos"** — CSV → bilingual COSSEC PDF, screen capture, Spanish voiceover
- [ ] Optimize LinkedIn: Spanish profile, headline naming ALM + COSSEC + cooperativas, banner = report screenshot, Featured = the F1 video

### Weekend Aug 1–2 — the quiet work
- [ ] Build account plans for **Tier 0** (top 15 institutions)
- [ ] Write the Spanish E1–E4 sequence — **then delete every sentence that sounds like software marketing**
- [ ] Write the 15 hand-written Tier 0 emails, ready to send Monday

### Then
- **Week 2:** Tier 0 manual outreach begins (no infrastructure needed for 15 emails). Cold domains keep warming. First video publishes. LinkedIn commenting starts at 20/day.
- **Weeks 3–4:** Warmup completes → Tier 1 sequences go live at 5→10/day.
- **Week 5+:** Full cadence, 15–25 sends/day, one field day per week.

---

## 13. Open items to verify

Carried from `CERNIQ_MARKET_BIBLE.md` §9 plus additions from this plan. **Anything marked ⚠ blocks a Q3'26 action.**

| # | Item | Owner action |
|---|---|---|
| ⚠ 1 | **ASEC Seminario Residencial 2026 date** — historically ~August, could be imminent | Email Dahlia Torres, Week 1 Day 1 |
| ⚠ 2 | **PR Cooperativista October editorial deadline** — assume 4–6 wks lead | Email Grace Matos, Week 1 Day 1 |
| ⚠ 3 | **Q2-2026 COSSEC statistical PDF release date** (~mid-Sept) — sets the Índice publication date | Watch `docs.pr.gov` COSSEC repository |
| 4 | ASEC Convención 2027 date + booth cost | Dahlia Torres |
| 5 | CENASE seminar proposal process | Lissette Estevez, `educacion@liga.coop` |
| 6 | Liga asamblea anual date; Consejos Regionales calendar | `info@liga.coop` |
| 7 | **Which of the 57+ cooperativas hold mortgage books** (the FHLBNY target list) | Audited FS review or COSSEC contact. High value — this defines the Wedge-1 campaign list. |
| 8 | **Re-verify Mabel Jiménez Miranda** (COSSEC Presidenta Ejecutiva) before any contact | cossec.pr.gov |
| 9 | Current exec presidents: COOPACA, CamuyCoop, Zeno Gandía, Saulo D. Rodríguez, Cidreña | ASEC Socios directory or phone |
| 10 | Operative RAP→GAAP date (Jan vs. June 2028) post-FOMB objection | Monitor; never quote a hard date in sales |
| 11 | AITSA technical specification (file format/schema) | COSSEC — **this is the integration moat**, Q3'27 |
| 12 | FHLBNY capital-stock purchase requirements (Capital Plan) | fhlbny.com or Alexies Sornoza |
| 13 | USICOOP current status; Sharetec Velocity export spec | Vendor contact, Q3'27 |

---

## Appendix A — What this plan deliberately does NOT do, and why

| Not doing | Why |
|---|---|
| Paid ads (Google/Meta/LinkedIn) | 350-person TAM. You can reach every one of them by name for free. Ads are the wrong instrument at this scale. |
| A large-volume email operation | See §6.1. The list is the ceiling, not the sending capacity. |
| A YouTube audience-growth strategy | The audience is 350 people and none of them are found through YouTube discovery. YouTube is a library, not a channel. |
| Community banks / family offices as a Q3–Q4'26 focus | Supported in the codebase, but the cooperativa wedge (COSSEC + FHLBNY + Spanish) does not transfer. Splitting focus at $0 revenue is fatal. |
| Approaching Liga, COSSEC, or BanCoop before Q4'26 | One-shot conversations. Spend them from strength. |
| Chasing $1M ARR by Sept 2027 | Arithmetically unreachable from $0 in July 2026 in a 60-institution ICP. Named honestly so you measure against reality. §3.1. |
| Entering a second market before Q4'27 | Entering market two before winning market one is the most common way a beachhead business dies. |

## Appendix B — Housekeeping fixes required before any outbound

1. **Pricing:** `demo/PRICING_ONE_PAGER.md` ($750 / $299 / $499) contradicts Vol.5 §1.4 ($499 / $399 / $799 / $199). Pick one. Recommendation in §2.3.
2. **Contact email:** `demo/PRICING_ONE_PAGER.md` lists `pablo@cerniq.com`. Should be `erwin@cerniq.io`.
3. **Outbound channel doc:** `sales/OUTBOUND_PLAYBOOK.md` Channel 2 instructs cold-emailing from `cerniq.io` via Resend. Amend it to point at §6.2 of this document.
4. **Social proof claims — fix this before anything else.** Live templates assert customers you do not have:
   - `sales/OUTBOUND_PLAYBOOK.md:58` — *"3 instituciones en piloto, $1.1B+ en activos bajo analisis"*
   - `sales/OUTBOUND_PLAYBOOK.md:120-121` — subject line *"3 cooperativas ya estan usando CERNIQ"* + *"$1.1B+ in assets, 45% time reduction, 90% cost savings"*
   - `sales/DAILY_EXECUTION_PLAN.md:273` — LinkedIn post #6, *"3 instituciones, $1.1B..."*

   **These are not true at 0 customers.** In a 91-institution market where any CFO can verify with one phone call to a peer, an unverifiable claim is an existential credibility risk — and it would surface at exactly the moment you're asking Liga or ASEC to take you seriously. Strip every one of them until it is factual, then replace with what *is* true: the sector data, the methodology, and the Índice.

Item 4 is the most important line in this appendix.

---

*CerniQ · San Juan, Puerto Rico · Plan written 2026-07-25 · Review at each quarter close, aligned to the COSSEC statistical report cycle.*
