import {
  computeCooperativaHealthScore,
  gradeFromScore,
  scoreSnapshot,
  uncoveredUniverseRow,
  parseUniverseCsv,
  buildMarketScanReport,
} from './pr-market-quality.util';
import type { CossecCooperativaSnapshot } from '../data-pull/cossec-snapshots/cossec-2025q4';

describe('pr-market-quality.util', () => {
  const sample: CossecCooperativaSnapshot = {
    slug: 'test-coop',
    name: 'Cooperativa de Prueba',
    city: 'San Juan, PR',
    totalAssets: 250_000_000,
    members: 10_000,
    capitalRatioPct: 10,
    loanToDepositPct: 72,
    liquidityRatioPct: 22,
    niiMarginPct: 3.8,
    assetGrowthYoyPct: 4,
    asOfQuarter: 'Q3-2025',
    provenance: 'test',
  };

  it('scores capital/liquidity/NII/growth/loan mix into 0–100', () => {
    const score = computeCooperativaHealthScore({
      capitalRatioPct: 10,
      liquidityRatioPct: 22,
      niiMarginPct: 3.8,
      assetGrowthYoyPct: 4,
      loanToDepositPct: 72,
    });
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(100);
    expect(gradeFromScore(score)).toMatch(/^[A-D]$/);
  });

  it('snapshot_scored rows have no D1 gaps', () => {
    const row = scoreSnapshot(sample);
    expect(row.coverage).toBe('snapshot_scored');
    expect(row.healthScore).not.toBeNull();
    expect(row.gaps).toHaveLength(0);
  });

  it('universe-only rows refuse silent zeros (D1)', () => {
    const row = uncoveredUniverseRow({
      name: 'Cooperativa Sin Snapshot',
      location: 'Ponce, PR',
      estimatedAssets: 50_000_000,
      region: 'South',
    });
    expect(row.coverage).toBe('universe_only');
    expect(row.healthScore).toBeNull();
    expect(row.gaps[0]?.reason).toBe('NO_CURATED_COSSEC_SNAPSHOT');
  });

  it('parses outbound CSV universe', () => {
    const csv = `institution,institution_type,location,estimated_assets,public_data_source,contact_role,region
Cooperativa de Ahorro y Crédito de Aguada,cooperativa,"Aguada, PR",150000000,cossec,CFO,West
Cooperativa de Ahorro y Crédito Oriental,cooperativa,"Humacao, PR",450000000,cossec,VP Finanzas,East
`;
    const rows = parseUniverseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toContain('Aguada');
    expect(rows[1]?.estimatedAssets).toBe(450_000_000);
  });

  it('buildMarketScanReport covers universe + discloses provisional benchmarks', () => {
    const report = buildMarketScanReport({
      universe: [
        {
          name: sample.name,
          location: sample.city,
          estimatedAssets: sample.totalAssets,
          region: 'Metro',
        },
        {
          name: 'Cooperativa Sin Snapshot',
          location: 'Ponce, PR',
          estimatedAssets: 40_000_000,
          region: 'South',
        },
      ],
      snapshots: [sample],
      nowIso: '2026-07-12T00:00:00.000Z',
    });
    expect(report.scoredCount).toBe(1);
    expect(report.uncoveredCount).toBe(1);
    expect(report.universeCount).toBe(2);
    expect(report.sectorBenchmarks.provisional).toBe(true);
    expect(report.disclosures.some((d) => d.includes('DATA_UNAVAILABLE'))).toBe(
      true,
    );
  });
});
