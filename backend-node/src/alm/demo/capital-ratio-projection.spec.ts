/**
 * Specs for the seeded capital-ratio-under-stress projection.
 *
 * Assertions are relationship-based: the deterministic centre equals
 * (equity − losses)/assets, the band is centred on it, more loss ⇒ lower ratio
 * and higher breach probability, and the whole thing is reproducible from the
 * seed (SR 11-7). No frozen output literals.
 */
import {
  projectCapitalRatioUnderStress,
  CapitalRatioProjectionInput,
} from './capital-ratio-projection';

const BASE: CapitalRatioProjectionInput = {
  baseEquity: 25,
  totalAssets: 250,
  cossecMinimumPct: 7,
  deterministicLosses: { creditLoss: 2.4, depositCost: 0.16, niiShortfall: 0 },
  seed: 'sic:test',
  paths: 5000,
};

describe('projectCapitalRatioUnderStress', () => {
  it('baseline capital ratio = equity / total assets', () => {
    expect(
      projectCapitalRatioUnderStress(BASE).baselineCapitalRatioPct,
    ).toBeCloseTo((BASE.baseEquity / BASE.totalAssets) * 100, 6);
  });

  it('deterministic stressed ratio = (equity − total loss) / assets', () => {
    const r = projectCapitalRatioUnderStress(BASE);
    const totalLoss = 2.4 + 0.16 + 0;
    expect(r.deterministic.totalLoss).toBeCloseTo(totalLoss, 6);
    expect(r.deterministic.stressedCapitalRatioPct).toBeCloseTo(
      ((BASE.baseEquity - totalLoss) / BASE.totalAssets) * 100,
      2,
    );
  });

  it('the band is centred on the deterministic estimate (median ≈ centre)', () => {
    const r = projectCapitalRatioUnderStress(BASE);
    expect(r.distribution.p50).toBeCloseTo(
      r.deterministic.stressedCapitalRatioPct,
      1,
    );
  });

  it('percentiles are ordered p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95', () => {
    const d = projectCapitalRatioUnderStress(BASE).distribution;
    expect(d.p5).toBeLessThanOrEqual(d.p25);
    expect(d.p25).toBeLessThanOrEqual(d.p50);
    expect(d.p50).toBeLessThanOrEqual(d.p75);
    expect(d.p75).toBeLessThanOrEqual(d.p95);
  });

  it('the adverse tail (p5) sits below baseline — stress erodes capital', () => {
    const r = projectCapitalRatioUnderStress(BASE);
    expect(r.distribution.p5).toBeLessThan(r.baselineCapitalRatioPct);
  });

  it('is reproducible — same seed yields a deep-equal result (SR 11-7)', () => {
    expect(projectCapitalRatioUnderStress(BASE)).toEqual(
      projectCapitalRatioUnderStress(BASE),
    );
  });

  it('a different seed keeps the centre but redraws the band', () => {
    const a = projectCapitalRatioUnderStress(BASE);
    const b = projectCapitalRatioUnderStress({ ...BASE, seed: 'sic:other' });
    expect(b.deterministic.stressedCapitalRatioPct).toBeCloseTo(
      a.deterministic.stressedCapitalRatioPct,
      6,
    );
    expect(b.distribution).not.toEqual(a.distribution);
  });

  it('larger losses ⇒ lower stressed ratio and ≥ breach probability', () => {
    const mild = projectCapitalRatioUnderStress(BASE);
    const severe = projectCapitalRatioUnderStress({
      ...BASE,
      deterministicLosses: { creditLoss: 12, depositCost: 2, niiShortfall: 3 },
    });
    expect(severe.deterministic.stressedCapitalRatioPct).toBeLessThan(
      mild.deterministic.stressedCapitalRatioPct,
    );
    expect(severe.breachProbabilityPct).toBeGreaterThanOrEqual(
      mild.breachProbabilityPct,
    );
  });

  it('flags a breach when losses push the centre below the floor', () => {
    // equity 25 / assets 250, floor 7% ⇒ a $9M loss → 6.4% < 7%.
    const r = projectCapitalRatioUnderStress({
      ...BASE,
      deterministicLosses: { creditLoss: 9, depositCost: 0, niiShortfall: 0 },
    });
    expect(r.deterministic.stressedCapitalRatioPct).toBeLessThan(7);
    expect(r.breachesFloorAtAdverseTail).toBe(true);
    expect(r.breachProbabilityPct).toBeGreaterThan(50);
  });

  it('discloses its model assumptions (seed, CVs, parametric basis)', () => {
    const r = projectCapitalRatioUnderStress(BASE);
    expect(r.disclosures.length).toBeGreaterThan(0);
    expect(r.disclosures.join(' ')).toMatch(/seed/i);
    expect(r.disclosures.join(' ')).toMatch(/parametric|CV/i);
  });
});
