# PR Cooperativa Market Scan — Coverage Methodology

**Command:** `npm run market:quality-scan`  
**Implementation:** `backend-node/scripts/market-quality-scan.ts`  
**Scoring util:** `backend-node/src/alm/market-scan/pr-market-quality.util.ts`

---

## Universe sources

| Source | Count | Role |
|---|---|---|
| `services/outbound/data/puerto_rico_cooperativas_seed.csv` | **112 rows** (111 institutions + header) | GTM outbound universe |
| `docs/CERNIQ_MARKET_BIBLE.md` | **91 insured** (COSSEC/AITSA) | Regulatory TAM |
| `cossec-2025q4.ts` curated snapshots | **13** | Ratio-backed scoring |

**Reconciliation note:** The CSV includes specialty/employer coops and naming variants not always in the 91-insured regulatory count. The scan **does not fabricate ratios** for institutions without curated snapshots — they appear as `universe_only` with `NO_CURATED_COSSEC_SNAPSHOT` (D1).

---

## Scoring model

Health score (0–100) uses the same weights as `FreeReportService.computeHealthScore`:

| Pillar | Weight | Floor → excellent |
|---|---|---|
| Capital ratio | 20 | 7% → 12%+ |
| Liquidity ratio | 20 | 15% → 30%+ |
| NII margin | 20 | 2.5% → 4.5%+ |
| Asset growth YoY | 20 | 0% → 6%+ |
| Loan/deposit balance | 20 | optimal 65–80% |

Grades: A ≥80, B ≥65, C ≥50, D <50.

**Disclosure:** Sector peer quartiles in benchmarks are **provisional** — not official COSSEC per-ratio distributions. Health score is a **GTM composite**, not a CAEL/COSSEC regulatory grade.

---

## Coverage statuses

| Status | Meaning |
|---|---|
| `snapshot_scored` | Curated COSSEC ratios present; health score computed |
| `universe_only` | Listed in outbound CSV; no snapshot — score null |
| `data_unavailable` | Reserved for future partial-ratio cases |

---

## Outputs

```bash
# Summary table
npm run market:quality-scan

# Machine-readable
npm run market:quality-scan -- --json=/tmp/market-scan.json

# HTML report for founders / sales
npm run market:quality-scan -- --html=/tmp/market-scan.html

# Ratchet self-test (Tier A)
npm run market:quality-scan -- --self-test
```

Self-test asserts: scored ≥13, universe ≥100, uncovered ≥1, no silent zero on uncovered rows.

---

## Expansion roadmap (13 → 91)

1. **Quarterly COSSEC statistics pull** — anchor total assets, capital, liquidity from Anejo 9 / quarterly bulletins
2. **Per-cooperativa annual reports** — where published, replace sector-median fillers in `CossecDataPullService.buildResult`
3. **Add slug to `COSSEC_SNAPSHOT_2025Q4`** — one institution per PR, with provenance string
4. **Ratchet `--self-test`** floor when coverage increases
5. **Optional golden:** `backend-node/test/golden/market-scan-2025q4.expected.json`

Priority expansion order (by assets, from Market Bible top-20): Caguas, Oriental, San Juan, Guaynabo, Bayamón, Ponce, Carolina, Mayagüez, Arecibo, Humacao…

---

## Integration points

| Consumer | Usage |
|---|---|
| Free report funnel | `FreeReportService` fuzzy-match + health score |
| Prospect CRM | `ProspectInstitution.publicDataIdentifier` = snapshot slug |
| Admin prospects | Sample report generation via `CossecDataPullService` |
| Future admin heatmap | Persist scan JSON to `EnterpriseBatch` (not v1) |
