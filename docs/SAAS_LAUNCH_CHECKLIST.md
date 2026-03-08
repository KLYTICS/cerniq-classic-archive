# SAAS-12: CapexCycle SaaS Launch Checklist

**Owner:** Erwin Kiess-Alfonso / KLYTICS LLC
**Target:** Zero-touch revenue while sleeping ($750/mo MRR)

---

## Pre-Launch: Infrastructure

- [ ] **Stripe Products** — Create in Stripe Dashboard:
  - [ ] One-Time Report ($499) — `payment` mode
  - [ ] Monthly Monitoring ($299/mo) — `subscription` mode
  - [ ] Annual Package ($2,400/yr) — `subscription` mode
  - [ ] Partner Multi-Client ($499/mo) — `subscription` mode
- [ ] **Stripe Webhook** — Configure endpoint: `<backend>/api/billing/webhook`
  - [ ] Events: `checkout.session.completed`, `customer.subscription.created`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `charge.dispute.created`
- [ ] **Environment Variables** — Set in Vercel/production:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_PRICE_ONE_TIME`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_PARTNER`
  - [ ] `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
  - [ ] `RESEND_API_KEY`
  - [ ] `JWT_SECRET` (min 32 chars)
  - [ ] `FRONTEND_URL` (production URL)
- [ ] **Cloudflare R2** — Create bucket `capexcycle-reports`, generate API keys
- [ ] **Resend** — Verify sending domain, configure from addresses
- [ ] **Database Migration** — Run `npx prisma migrate deploy` in production

## Pre-Launch: Testing

- [ ] **Payment Flow** — Test with Stripe test cards:
  - [ ] One-time checkout → user created → report job created → magic link sent
  - [ ] Monthly subscription → recurring invoice → auto report job
  - [ ] Failed payment → past_due status → notification
  - [ ] Cancellation → cancelled status → win-back scheduled
- [ ] **Portal Flow** — End-to-end:
  - [ ] Magic link login → cookie set → portal loaded
  - [ ] Data submission → CSV validation → job queued
  - [ ] Report delivery → PDF download → language toggle
  - [ ] Billing portal → Stripe portal opens → plan change
- [ ] **Pipeline Flow** — Automated:
  - [ ] Job queued → processing → PDF generated → uploaded → complete
  - [ ] Stuck job → auto-retry (30 min) → max 3 retries → failed + alert
  - [ ] Admin force-advance, force-fail, force-regenerate
- [ ] **Email Sequences** — Verify delivery:
  - [ ] B1: Welcome email with magic link
  - [ ] B2: Data submission reminder (30 min)
  - [ ] B3: Check-in (48h)
  - [ ] C1: Report ready notification
  - [ ] C2: Follow-up (24h after delivery)
  - [ ] Revenue alerts to erwin@klytics.io

## Pre-Launch: Security

- [ ] **Cookie Security** — `httpOnly: true`, `secure: true`, `sameSite: lax`
- [ ] **Rate Limiting** — Auth endpoints: 3-5/min, global: 100/min
- [ ] **Webhook Signature** — Stripe signature verification active
- [ ] **Magic Link** — 24h expiry, one-time use, cryptographic token
- [ ] **CORS** — Only allow production frontend URL
- [ ] **Helmet** — Security headers enabled in production

## Launch: Go-Live

- [ ] **Landing Page** — Add pricing section with Stripe checkout links
- [ ] **DNS** — Point production domain
- [ ] **SSL** — HTTPS on all endpoints
- [ ] **Monitoring** — Verify daily health email fires at 8am AST
- [ ] **First Client** — Run one real end-to-end payment + report cycle

## Post-Launch: Optimization

- [ ] **Analytics** — Verify Segment events flowing to GA4/PostHog
- [ ] **Funnel Metrics** — Track: landing → checkout → portal login → data submit → report delivered
- [ ] **Lead Nurture** — Enable A1/A2 sequences for inbound leads
- [ ] **Win-Back** — Verify D5 email fires 90 days after cancellation
- [ ] **SEO** — Meta tags, Open Graph for portal pages
- [ ] **Feature Expansion** — API access, white-label, board presentations
