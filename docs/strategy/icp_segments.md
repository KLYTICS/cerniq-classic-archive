# CERNIQ ICP Segments

## Confirmed From Code + COSSEC Registry

### Primary ICP

- **Puerto Rico cooperativas de ahorro y crédito** insured by COSSEC (Ley 255-2002)
- Universe: **91** institutions (committed Anejo 9 registry at `backend-node/src/alm/data/registry/pr-cooperativas-q2-2025.json`)
- ICP tiers (from assets, wired in `lead-qualification.service.ts` + `icpTier` on `ProspectInstitution`):

| Tier | Assets | Count (Q2 2025) | Priority |
|---|---|---|---|
| **tier1** | ≥ $100M | 40 | Primary pitch targets (~84% of system assets) |
| **tier2** | $50–100M | 20 | Secondary |
| **tier3** | < $50M | 31 | Lower priority / long-tail |

Evidence:

- Registry loader + verify gate: `pr-cooperativas.registry.ts` / `verify-pr-cooperativa-registry.mjs`
- CRM seed: `LeadsService.seedProspectPipeline()` upserts all 91 by COSSEC charter
- Product shells: `MarketRegistrySeedService` → workspace `pr-market-map`
- `frontend/app/page.tsx` headlines cooperativas and credit unions
- COSSEC compliance paths for `type === 'cooperativa'`

### Adjacent (not COSSEC ICP)

- Federal credit unions in PR (NCUA, ~7) — supported product type, not primary outbound
- Community banks / CPA firms — secondary / channel

## Market Bible pointer

Authoritative market narrative + top-20 names: [`docs/CERNIQ_MARKET_BIBLE.md`](../CERNIQ_MARKET_BIBLE.md) §1.  
Operational registry (charters, assets, members): the JSON above (Q2 2025 Anejo 9 extract; refresh when Sep/Dec PDFs are available).

## Recommended Operating Focus

1. Outbound / pitch: tier1 cooperativas (≥$100M), Spanish-first, COSSEC/AITSA wedge
2. Demo seats: registry slugs (e.g. `rincon`, `coopaca`, `oriental`, `caguas`)
3. Channel test: CPA / advisory firms serving multiple coops
4. Do **not** reintroduce dissolved Coop Aguada
