# CERNIQ strategic scope — product and regulatory perimeter

Last updated: 2026-05.

## Default posture (in scope today)

**CERNIQ is an ALM analytics and compliance SaaS** for Puerto Rico cooperativas, credit unions, and community banks:

- Balance sheet ingestion, regulatory-style reporting (including COSSEC), risk and liquidity analytics, client portal, Stripe subscription billing.
- Sensitive data handled: institution financial aggregates, supervisory-style outputs, operational PII via auth and CRM surfaces.

Growth as a **financial powerhouse** within this perimeter means deeper vertical dominance (data moats, benchmarks, integrations, SSO, SLAs), not necessarily becoming a chartered institution or payments provider.

## Fork A — Recommended: scale within software + data ALM

- Enterprise sales, reseller/CPA routes, Partner API (read-first), benchmarking products.
- Security and compliance obligations map to typical **SOC 2 / HIPAA-style vendor diligence** depending on contracting, not banking licenses.

## Fork B — Out of scope unless explicitly chartered

Introducing **payments, deposits, lending, custody, brokerage, or money transmission** materially changes obligations:

| Area | Typical new surface |
|------|---------------------|
| PCI DSS | Payment card data |
| BSA / AML programs | Movement of funds |
| State / federal charters or MT licenses | Custody or transmission of fiat/crypto |
| Bank partnership / sponsor bank | BIN sponsorship, ACH, RTP |

Fork B requires a **separate trust boundary**, dedicated compliance program, and usually a **stand-alone codebase or service** segmented from the ALM Postgres estate.

## Decision rule

- **Proceed on Fork A** unless there is executive sign-off, legal/regulatory clearance, and an explicit product charter for Fork B.

This document fulfills the governance checkpoint to **prevent accidental scope creep** into regulated money movement while scaling the ALM platform.
