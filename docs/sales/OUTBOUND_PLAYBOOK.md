# CERNIQ Outbound Sales Playbook

**Owner:** Erwin Kiess-Alfonso
**Target:** 91 COSSEC-registered cooperativas + PR credit unions + CPA firms
**Goal:** 10 paying clients by Q3 2026
**Average Deal:** $750 (pilot) to $2,400/yr (annual)

---

## Total Addressable Market

| Segment | Count | Avg Assets | Priority |
|---------|-------|------------|----------|
| PR Cooperativas (COSSEC) | 91 | $185M median | TIER 1 |
| PR Credit Unions (NCUA) | ~15 | $300M+ | TIER 1 |
| PR CPA/Consulting Firms | ~30 | N/A (8-15 clients each) | TIER 2 |
| USVI Credit Unions | ~8 | $100M+ | TIER 3 |
| Community Banks (mainland) | 4,500+ | $500M+ | FUTURE |

**Focus for launch:** Tier 1 only. 91 cooperativas + 15 credit unions = 106 targets.

---

## Channel Strategy

### CHANNEL 1: LinkedIn (Primary — Start Here)

**Why first:** PR cooperativa CFOs and directors are on LinkedIn. Zero cost. Builds credibility before cold email. You can see who views your profile.

**Setup (Day 1-3):**
- [ ] Optimize LinkedIn profile:
  - Headline: "Founder, CERNIQ | ALM Intelligence for PR Cooperativas | 62 Modules, 34 Quant Models"
  - Banner: Screenshot of CERNIQ ALM dashboard with demo data
  - About: 3 paragraphs — problem (consultants charge $8K-$12K/quarter), solution (CERNIQ at $750), credibility (COSSEC format, 34 quant models)
  - Featured: Link to cerniq.io/demo
- [ ] Turn on Creator Mode
- [ ] Set profile to Spanish (primary audience is bilingual, but institutional culture leans Spanish)

**Warmup Phase (Week 1-2, 10 connections/day):**
- Connect with 10 cooperativa executives per day
- DO NOT PITCH in the connection request
- Connection message template (Spanish):

```
Hola [Nombre], soy Erwin de CERNIQ en San Juan. Estoy construyendo
herramientas de analisis ALM para cooperativas PR. Me gustaria
conectar con profesionales del sector. Saludos.
```

- Also connect with: COSSEC examiners, PR banking attorneys, ALCO committee members, university finance professors in PR

**Engagement Phase (Week 2-4, daily):**
- Comment on 3-5 posts from cooperativa leaders daily (genuine, insightful, no pitching)
- Share 2 posts per week:
  - **Post type 1:** Sector insight with data ("La mediana de ratio de capital del sector cooperativo PR es 9.2% en Q3 2025. Si su institucion esta por debajo, es hora de evaluar su estrategia ALM.")
  - **Post type 2:** Product showcase ("62 modulos ALM, 34 modelos cuantitativos, formato exacto COSSEC. Demo gratis en cerniq.io/demo")
  - **Post type 3:** Problem/pain point ("Un informe ALM trimestral cuesta $8K-$12K con consultores tradicionales. Nosotros lo entregamos por $750 en 24 horas, no 3-6 semanas.")
  - **Post type 4:** Social proof ("3 instituciones en piloto, $1.1B+ en activos bajo analisis")

**Outreach Phase (Week 3+, 5 DMs/day):**
- Only DM people who accepted your connection AND engaged with your content
- DM template (Spanish):

```
[Nombre], gracias por conectar. Vi que usted es [cargo] en [cooperativa].

Hemos estado analizando datos publicos de COSSEC y preparamos un
informe ALM de muestra para [cooperativa] — incluye brecha de duracion,
sensibilidad NII, prueba de estres Monte Carlo y comparacion con la
mediana del sector.

Es completamente gratuito, sin compromiso. Se lo puedo enviar por correo?

Saludos,
Erwin
```

**Daily LinkedIn Metrics (after warmup):**
| Activity | Target |
|----------|--------|
| New connections sent | 10 |
| Comments on others' posts | 5 |
| Own posts published | 2/week |
| DMs to warm connections | 5 |
| Profile views checked | daily |

---

### CHANNEL 2: Email (Secondary — Powered by Backend)

**Why:** Scalable, trackable, your backend already generates personalized outreach via `generateOutreach()`.

**Setup:**
- [ ] Verify cerniq.io domain in Resend
- [ ] Set up erwin@cerniq.io as sending address (not @klytics.io for brand consistency)
- [ ] Set up SPF, DKIM, DMARC records for cerniq.io (required for deliverability)
- [ ] Configure email warmup: Send 5-10 emails/day for first 2 weeks, then ramp to 20-30/day

**Email Warmup Schedule:**
| Week | Emails/Day | Target |
|------|-----------|--------|
| 1-2 | 5-10 | Existing contacts, friends, partners (replies boost sender reputation) |
| 3-4 | 10-15 | Tier 1 cooperativas (top 12 by assets) |
| 5+ | 20-30 | Full pipeline |

**Email Sequence (5-touch, 14 days):**

**Email 1 — Day 0 (Initial Outreach):**
- Subject: "Informe ALM gratuito para [Cooperativa]"
- Body: Use the `generateOutreach()` output from your backend — it includes asset benchmarks, sector median comparison, and personalized flags
- CTA: "Responda a este correo o programe una demo de 15 min"

**Email 2 — Day 3 (Value Add):**
- Subject: "Ratios COSSEC Q3 2025 — su cooperativa vs. la mediana"
- Body: Attach a 1-page benchmark comparison showing their public data vs. sector median
- Include: Capital ratio, loan-to-share, liquidity ratio, NIM
- CTA: "Vea como CERNIQ calcula estos ratios automaticamente"

**Email 3 — Day 7 (Social Proof):**
- Subject: "3 cooperativas ya estan usando CERNIQ"
- Body: Brief case study ($1.1B+ in assets, 45% time reduction, 90% cost savings)
- CTA: "Pruebe el demo interactivo: cerniq.io/demo"

**Email 4 — Day 10 (Urgency):**
- Subject: "La temporada de examenes COSSEC se acerca"
- Body: "Su proximo examen COSSEC incluira revision de politicas IRR, pruebas de estres, y ratios LCR. CERNIQ genera todo esto automaticamente."
- CTA: "Programa su demo antes del cierre trimestral"

**Email 5 — Day 14 (Breakup):**
- Subject: "Ultimo seguimiento — informe ALM para [Cooperativa]"
- Body: "Entiendo que puede no ser el momento. Le dejo el enlace al demo interactivo (cerniq.io/demo) por si le resulta util en el futuro. Su informe de muestra estara disponible si lo necesita."
- CTA: Soft close — leave the door open

**Using Your Backend to Generate Emails:**
```bash
# Seed prospect pipeline
curl -X POST https://api.cerniq.io/api/admin/seed-prospects \
  -H "x-admin-key: YOUR_ADMIN_KEY"

# List prospects (sorted by assets)
curl https://api.cerniq.io/api/leads/prospects \
  -H "x-admin-key: YOUR_ADMIN_KEY"

# Generate personalized outreach for a prospect
curl https://api.cerniq.io/api/leads/prospects/PROSPECT_ID/outreach?lang=es \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

**Daily Email Metrics (after warmup):**
| Activity | Target |
|----------|--------|
| New outreach emails sent | 15-20 |
| Follow-up emails sent | 10-15 |
| Reply rate (healthy) | >5% |
| Demo bookings from email | 2-3/week |
| Bounce rate (max) | <3% |

---

### CHANNEL 3: Phone/WhatsApp (Highest Conversion — After Email Opens)

**Why:** PR culture is relationship-driven. A warm call after an email open converts 3-5x better than another email. WhatsApp is used more than SMS in PR.

**When to call:** Only after a prospect has:
1. Opened your email (track via Resend), OR
2. Visited cerniq.io/demo (track via Segment), OR
3. Accepted your LinkedIn connection AND viewed your profile

**Finding phone numbers:**
- COSSEC annual reports list board members and officers
- LinkedIn profiles often have direct numbers
- Cooperativa websites have "Contactenos" pages with direct lines
- Ask ChatGPT to find public contact info from COSSEC filings

**Call Script (Spanish, 2 minutes max):**

```
Buenos dias, [Nombre]. Mi nombre es Erwin Kiess de CERNIQ.

Le escribi la semana pasada sobre un informe ALM de muestra que
preparamos para [Cooperativa] usando datos publicos de COSSEC.

Queria verificar si lo recibio y si le gustaria que le explique
los resultados en 15 minutos. Podemos hacerlo por Zoom o Teams.

[Si dice "no tengo tiempo":]
Entiendo perfectamente. Le puedo enviar el informe por correo
para que lo revise cuando le convenga? Solo toma 2 minutos verlo.

[Si dice "ya tenemos consultor ALM":]
Excelente. Muchas instituciones nos usan como complemento —
nuestro piloto de $750 incluye un informe completo que pueden
comparar con lo que reciben actualmente. Sin compromiso.

[Si dice "enviemelo":]
Perfecto, se lo envio hoy. Tambien le incluyo acceso al demo
interactivo con datos de FirstBank PR para que vea la plataforma
en accion. Le hago seguimiento el jueves?
```

**WhatsApp Follow-up (after voicemail/no answer):**
```
Hola [Nombre], soy Erwin de CERNIQ. Le deje un mensaje sobre
el informe ALM que preparamos para [Cooperativa]. Se lo puedo
enviar por correo — cual es la mejor direccion?

Demo interactivo: cerniq.io/demo
```

**Daily Call Metrics:**
| Activity | Target |
|----------|--------|
| Warm calls (email openers) | 5-8 |
| WhatsApp follow-ups | 5-10 |
| Conversations held | 2-3 |
| Demos booked from calls | 1-2/week |

---

### CHANNEL 4: Referrals (Highest Quality — Build System Early)

**Why:** One CPA firm referral = 8-15 cooperativa clients. One happy CFO referral = warm intro with credibility.

**Referral Sources to Target:**
1. **CPA firms serving cooperativas** — They do annual audits and know which cooperativas need ALM help. CERNIQ Partner tier ($499/mo) is built for them.
2. **COSSEC examiners** (informal) — They can't officially recommend products, but they can mention that "some cooperativas use tools like CERNIQ to prepare."
3. **Banking attorneys** — They handle regulatory compliance and can refer clients who need ALM documentation.
4. **Existing pilot clients** — After a successful pilot, ask: "Conoce a algun colega en otra cooperativa que podria beneficiarse?"

**CPA Firm Outreach (Partner Channel):**
- Subject: "Partnership: ALM Reports for Your Cooperativa Clients"
- Pitch: "You handle the audit. We handle ALM. Your clients get Goldman-grade analytics at $750/report. Partner pricing: $499/mo for unlimited institutions."
- CTA: "20-minute walkthrough — I'll show you how one CPA firm serves 8 cooperativas through CERNIQ"

**Referral Ask Script (after successful pilot):**
```
[Nombre], me alegra que el informe les haya resultado util.

Una pregunta — conoce a algun CFO o Director Financiero en otra
cooperativa que pueda estar buscando una solucion similar?

Si me conecta con alguien, le ofrecemos un mes gratuito adicional
como agradecimiento.
```

**Referral Program Structure:**
- Refer a cooperativa that buys = 1 month free
- Refer a CPA firm that becomes a partner = $500 credit
- Track all referrals via `referredBy` field in lead form (already built)

**Weekly Referral Metrics:**
| Activity | Target |
|----------|--------|
| Referral asks made | 2-3/week |
| Referral intros received | 1/week |
| CPA firm outreach | 2/week |

---

### CHANNEL 5: Events & Conferences (Quarterly — High Impact)

**PR Financial Industry Events:**
- **COSSEC Annual Conference** — Must attend. All 91 cooperativas send representatives. Book a booth or at minimum attend and network.
- **Liga de Cooperativas de PR** — Monthly meetings. Ask to present a 10-minute ALM demo.
- **PR Bankers Association** — Quarterly events. Good for credit union contacts.
- **ACUP (Asociacion de Cooperativas de PR)** — Industry association events.

**Conference Playbook:**
1. Before: Email 20 attendees with "See you at [event] — free ALM report"
2. During: Collect business cards, do 2-minute live demos on tablet/laptop
3. After (within 24h): Send personalized follow-up email with demo link + their institution's sample report

**Conference Metrics:**
| Activity | Target |
|----------|--------|
| Business cards collected | 15-20 |
| Live demos given | 8-10 |
| Follow-up emails sent (within 24h) | 100% of contacts |
| Demos booked from event | 3-5 |

---

## Daily Outbound Rhythm (After Warmup — Week 5+)

### Morning Block (8:30-10:00 AM AST)

| Time | Activity | Volume |
|------|----------|--------|
| 8:30 | Check LinkedIn notifications + respond to DMs | 15 min |
| 8:45 | Comment on 5 cooperativa leaders' posts | 20 min |
| 9:05 | Send 10 LinkedIn connection requests | 15 min |
| 9:20 | Send 5 LinkedIn DMs to warm connections | 20 min |
| 9:40 | Publish 1 LinkedIn post (if scheduled) | 10 min |

### Mid-Morning Block (10:00-11:30 AM AST)

| Time | Activity | Volume |
|------|----------|--------|
| 10:00 | Review email opens/replies from yesterday | 10 min |
| 10:10 | Make 5-8 warm calls (email openers) | 40 min |
| 10:50 | Send 5-10 WhatsApp follow-ups | 15 min |
| 11:05 | Send 15-20 new outreach emails | 25 min |

### Afternoon Block (2:00-3:00 PM AST)

| Time | Activity | Volume |
|------|----------|--------|
| 2:00 | Send 10-15 follow-up emails (sequence touches) | 20 min |
| 2:20 | Update CRM (lead status, notes) | 15 min |
| 2:35 | Research 5 new prospects for tomorrow | 15 min |
| 2:50 | Make 2-3 referral asks | 10 min |

### End of Day (4:30-5:00 PM AST)

| Time | Activity | Volume |
|------|----------|--------|
| 4:30 | Log daily metrics in spreadsheet | 10 min |
| 4:40 | Plan tomorrow's call list | 10 min |
| 4:50 | Queue LinkedIn post for tomorrow | 10 min |

---

## Daily Metrics Dashboard (Track in Google Sheets)

| Metric | Daily Target | Weekly Target |
|--------|-------------|--------------|
| LinkedIn connections sent | 10 | 50 |
| LinkedIn DMs sent | 5 | 25 |
| LinkedIn comments | 5 | 25 |
| LinkedIn posts | - | 2 |
| New outreach emails | 15-20 | 75-100 |
| Follow-up emails | 10-15 | 50-75 |
| Warm calls made | 5-8 | 25-40 |
| WhatsApp follow-ups | 5-10 | 25-50 |
| Demos booked | - | 3-5 |
| Demos completed | - | 2-3 |
| Proposals sent | - | 1-2 |
| Deals closed | - | 0.5-1 |

---

## Conversion Funnel Expectations

| Stage | Volume/Month | Conversion | Notes |
|-------|-------------|------------|-------|
| Outreach (email + LinkedIn + calls) | 400 touches | - | All channels combined |
| Opens/Views | 120-160 | 30-40% | Email open rate + LinkedIn views |
| Replies/Responses | 20-30 | 15-20% of opens | Includes LinkedIn DM replies |
| Demo Booked | 10-15 | 50% of responses | 15-minute Zoom/Teams |
| Demo Completed | 8-12 | 80% show rate | FirstBank PR live data |
| Proposal/Pilot Sent | 5-8 | 60% of demos | $750 one-time or $299/mo |
| Closed Won | 3-5 | 50-60% of proposals | Cooperativas decide quickly |

**Month 1 realistic target:** 2-3 pilot clients ($1,500-$2,250 revenue)
**Month 3 target:** 5-8 active clients ($6,000-$19,200 ARR)
**Month 6 target:** 10-15 active clients ($24,000-$36,000 ARR)

---

## What to Say — Key Talking Points

### Pain Points to Hammer

1. **Cost:** "Su cooperativa paga $8,000-$12,000 por un informe ALM trimestral. CERNIQ lo entrega por $750."
2. **Speed:** "Consultores tardan 3-6 semanas. CERNIQ entrega en 24 horas."
3. **Exam prep:** "El proximo examen COSSEC incluye revision de IRR, estres testing y CECL. CERNIQ cubre los 20 requisitos regulatorios."
4. **Benchmark:** "Sepa exactamente como se compara su cooperativa con la mediana del sector — ratio de capital, LCR, NIM, todo automatico."

### Objection Handling

| Objection | Response |
|-----------|----------|
| "Ya tenemos consultor" | "Perfecto. El piloto de $750 le da un informe completo para comparar. Si CERNIQ no mejora lo que reciben hoy, no gasta nada mas." |
| "No tenemos presupuesto" | "El piloto es $750 una sola vez — menos de lo que cuesta una sola reunion de ALCO. Y le ahorra $30K+ al ano." |
| "No tenemos tiempo" | "Entiendo. Solamente necesitamos su balance general — nosotros hacemos el resto. Literalmente 5 minutos de su tiempo." |
| "Necesito aprobacion de la junta" | "Le preparo un resumen ejecutivo de una pagina que puede presentar. Incluye ROI calculado y comparacion con costos actuales." |
| "Nuestros datos son confidenciales" | "Los datos se cifran con AES-256 en reposo y TLS 1.3 en transito. Control de acceso basado en roles. Politica de privacidad en cerniq.io/privacy." |
| "Es muy nuevo, no lo conozco" | "Le invito a probar el demo interactivo con datos de FirstBank PR — sin necesidad de registrarse. Vea los 62 modulos ALM en accion." |

---

## Week 1-4 Startup Checklist

### Week 1: Foundation
- [ ] Optimize LinkedIn profile (headline, banner, about, featured)
- [ ] Verify cerniq.io domain in Resend (SPF, DKIM, DMARC)
- [ ] Seed prospect pipeline: `POST /api/admin/seed-prospects`
- [ ] Send 10 LinkedIn connections/day (personal network + cooperativa leaders)
- [ ] Send 5 warmup emails to personal contacts
- [ ] Create LinkedIn content calendar (8 posts for month 1)
- [ ] Print/save COSSEC cooperativa directory with contact info
- [ ] Research phone numbers for top 12 cooperativas by assets

### Week 2: Engagement
- [ ] Continue 10 LinkedIn connections/day
- [ ] Start commenting on 5 posts/day
- [ ] Send first LinkedIn post (sector insight with benchmark data)
- [ ] Begin email outreach to top 5 cooperativas (using generateOutreach)
- [ ] Start tracking metrics in Google Sheets
- [ ] Set up UptimeRobot for cerniq.io + api.cerniq.io

### Week 3: Scale
- [ ] Begin LinkedIn DMs to warm connections (5/day)
- [ ] Scale email to 10-15/day
- [ ] Make first warm calls to email openers
- [ ] Send second LinkedIn post
- [ ] Begin WhatsApp follow-ups
- [ ] First referral ask to any existing contact in cooperativa sector

### Week 4: Full Pipeline
- [ ] Hit daily rhythm (see Daily Outbound Rhythm above)
- [ ] First demos should be happening this week
- [ ] Send first CPA firm outreach (partner channel)
- [ ] Research upcoming COSSEC/Liga events
- [ ] Review metrics and adjust approach based on response rates

---

## Tools You Already Have

| Tool | Purpose | How to Access |
|------|---------|---------------|
| Prospect Pipeline | 12 cooperativas seeded with COSSEC data | `POST /api/admin/seed-prospects` |
| Outreach Generator | Personalized email with benchmarks | `GET /api/leads/prospects/:id/outreach?lang=es` |
| Lead CRM | Track pipeline, status, notes, revenue | Admin panel at cerniq.io/admin/pipeline |
| Pipeline Metrics | Conversion rates, revenue, avg close time | `GET /api/leads/metrics` |
| Demo Platform | Interactive walkthrough with live data | cerniq.io/demo |
| ROI Calculator | Quantify savings for prospects | cerniq.io/roi |
| Compliance Matrix | Show regulatory coverage | cerniq.io/compliance |
| Analytics Tracking | Funnel events via Segment | cerniq.io/admin/metrics |

---

## Key Numbers to Remember

- **91** COSSEC-registered cooperativas
- **$185M** sector median total assets
- **9.2%** sector median capital ratio
- **$8K-$12K** what consultants charge per quarter
- **$750** CERNIQ pilot price
- **83-93%** cost savings vs. traditional
- **24 hours** CERNIQ delivery time vs. 3-6 weeks
- **62** ALM modules, **34** quant models
- **EN/ES** bilingual everything
