# CERNIQ Weekly Operation Plan

Date: 2026-04-05

## Goal

Make CERNIQ fully operational this week as a narrow, sellable wedge:

**Bilingual ALM reporting for cooperativas, credit unions, and CPA/advisory partners.**

This plan references the current CERNIQ repo state and the `AGENT CENTER` product note that positions CERNIQ as the active KLYTICS financial-institutions product.

## Current Ground Truth

- Public production gate is green on `cerniq.io` and `api.cerniq.io`.
- The core public path is healthy: homepage, pricing, login, portal, ALM, and API health all return `200`.
- The current operational wedge in repo docs is upload -> analyze -> bilingual PDF -> billing -> portal follow-up.
- Optional market-data surfaces are not reliable enough to act as the weekly launch gate.
- The CSV onboarding template must be treated as mission critical because it sits directly in the upload path.

## This Week's Definition Of Operational

CERNIQ counts as operational this week when all of the following are true:

1. A prospect can reach the site, understand the wedge in seconds, and start a pilot.
2. A pilot customer can download the CSV template, upload data, and reach report generation without manual intervention.
3. Billing, email, and portal retrieval are verified on the active production stack.
4. Sales and founder outreach can point to one clean sample workflow and one clear price ladder.
5. We can defend a concrete operating valuation from the current product and GTM posture.

## Execution Lanes

### 1. Core Product Reliability

- Keep the public onboarding template frontend-hosted so template download does not depend on a backend CSV route.
- Treat `scripts/health-check.sh` as the real public go-live gate.
- Treat `scripts/smoke-test.sh` as secondary for protected and advisory API coverage.
- Re-verify Stripe checkout, sample report generation, report download, and portal job progression before any live outreach burst.

### 2. Public Story

- Keep all public messaging on the ALM wedge only.
- Do not lead with the broader quant, market-data, valuation, or execution surfaces.
- Use the repo's pricing spine consistently:
  - Pilot report: `$750`
  - Platform: `$299/mo`
  - Partner: `$499/mo`

### 3. Proof Assets

- Ship one sample report link.
- Ship one short upload-to-report walkthrough.
- Ship one one-page explainer PDF.

### 4. Revenue Motion

- Prioritize Puerto Rico cooperativas first.
- Use CPA/advisory firms as the multiplier channel.
- Track progress in terms of pilots proposed, pilots run, recurring conversions, and days from first contact to pilot.

## Hard Weekly Checklist

- [ ] Public production gate passes.
- [ ] Template download works from the live frontend.
- [ ] Pricing CTA reaches Stripe correctly.
- [ ] One real pilot-ready sample report is available.
- [ ] One walkthrough asset is ready to send.
- [ ] 30-50 targets are loaded for outreach.
- [ ] 3 pilot conversations are targeted this week.

## Operating Note

The launch standard is not “every route in the repo is perfect.” The launch standard is that the ALM wedge is trustworthy, fast to understand, and safe to sell.
