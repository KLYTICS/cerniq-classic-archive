import { CreditMigrationService } from './credit-migration.service';

describe('CreditMigrationService', () => {
  let service: CreditMigrationService;

  const RATINGS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'];

  beforeEach(() => {
    service = new CreditMigrationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── 1. Identity matrix when all entities stay in same rating ──

  it('generates identity matrix when no transitions occur', () => {
    const result = service.generateTransitionMatrix({
      historicalRatings: [
        { entity: 'A', period: 1, rating: 'AAA' },
        { entity: 'A', period: 2, rating: 'AAA' },
        { entity: 'A', period: 3, rating: 'AAA' },
        { entity: 'B', period: 1, rating: 'BBB' },
        { entity: 'B', period: 2, rating: 'BBB' },
      ],
    });

    // AAA row: stays at AAA
    expect(result.matrix[0][0]).toBe(1.0);
    expect(result.matrix[0][1]).toBe(0.0);

    // BBB row: stays at BBB
    expect(result.matrix[3][3]).toBe(1.0);

    // Unobserved ratings (AA, A, etc.) should default to identity
    expect(result.matrix[1][1]).toBe(1.0); // AA stays AA
    expect(result.matrix[2][2]).toBe(1.0); // A stays A
  });

  // ── 2. Known transition probabilities from data ───────────

  it('computes correct transition probabilities from historical data', () => {
    // 4 entities in BBB: 2 stay, 1 upgrades to A, 1 downgrades to BB
    const result = service.generateTransitionMatrix({
      historicalRatings: [
        { entity: 'E1', period: 1, rating: 'BBB' },
        { entity: 'E1', period: 2, rating: 'BBB' },
        { entity: 'E2', period: 1, rating: 'BBB' },
        { entity: 'E2', period: 2, rating: 'BBB' },
        { entity: 'E3', period: 1, rating: 'BBB' },
        { entity: 'E3', period: 2, rating: 'A' },
        { entity: 'E4', period: 1, rating: 'BBB' },
        { entity: 'E4', period: 2, rating: 'BB' },
      ],
    });

    const bbbIdx = RATINGS.indexOf('BBB'); // 3
    const aIdx = RATINGS.indexOf('A'); // 2
    const bbIdx = RATINGS.indexOf('BB'); // 4

    expect(result.matrix[bbbIdx][bbbIdx]).toBeCloseTo(0.5, 4); // 2/4
    expect(result.matrix[bbbIdx][aIdx]).toBeCloseTo(0.25, 4); // 1/4
    expect(result.matrix[bbbIdx][bbIdx]).toBeCloseTo(0.25, 4); // 1/4
    expect(result.sampleSize).toBe(4);
  });

  // ── 3. All matrix rows sum to 1.0 ────────────────────────

  it('all rows of the transition matrix sum to 1.0', () => {
    const result = service.generateTransitionMatrix({
      historicalRatings: [
        { entity: 'X', period: 1, rating: 'A' },
        { entity: 'X', period: 2, rating: 'BBB' },
        { entity: 'Y', period: 1, rating: 'BBB' },
        { entity: 'Y', period: 2, rating: 'BB' },
        { entity: 'Z', period: 1, rating: 'BB' },
        { entity: 'Z', period: 2, rating: 'B' },
      ],
    });

    for (let i = 0; i < result.matrix.length; i++) {
      const rowSum = result.matrix[i].reduce((a, b) => a + b, 0);
      expect(rowSum).toBeCloseTo(1.0, 8);
    }
  });

  // ── 4. Default (D) is an absorbing state ─────────────────

  it("default is an absorbing state in Moody's defaults", () => {
    const result = service.generateTransitionMatrix({
      historicalRatings: [], // Use defaults
    });

    const dIdx = RATINGS.indexOf('D'); // 7
    expect(result.matrix[dIdx][dIdx]).toBe(1.0);
    for (let j = 0; j < dIdx; j++) {
      expect(result.matrix[dIdx][j]).toBe(0.0);
    }
  });

  // ── 5. Moody's defaults returned when no data ────────────

  it("returns Moody's default matrix when no historical data provided", () => {
    const result = service.generateTransitionMatrix({
      historicalRatings: [],
    });

    expect(result.ratings).toEqual(RATINGS);
    expect(result.matrix.length).toBe(8);
    expect(result.sampleSize).toBe(0);

    // AAA should have very high stay probability
    expect(result.matrix[0][0]).toBeGreaterThan(0.85);
    // All rows sum to 1
    for (const row of result.matrix) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 4);
    }
  });

  // ── 6. Stress increases downgrade probabilities ──────────

  it('stress factor > 1 increases downgrade probabilities', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const stressed = service.stressTransitionMatrix({
      baseMatrix: base.matrix,
      ratings: base.ratings,
      stressFactor: 2.0,
    });

    // For each non-default row, downgrade probability should increase
    for (let i = 0; i < base.ratings.length - 1; i++) {
      let baseDowngrade = 0;
      let stressedDowngrade = 0;
      for (let j = i + 1; j < base.ratings.length; j++) {
        baseDowngrade += base.matrix[i][j];
        stressedDowngrade += stressed.stressedMatrix[i][j];
      }
      // Skip rows with zero downgrade probability
      if (baseDowngrade > 0) {
        expect(stressedDowngrade).toBeGreaterThan(baseDowngrade);
      }
    }

    // Average change should be positive
    expect(stressed.avgDowngradeProbChange).toBeGreaterThan(0);
  });

  // ── 7. Stressed matrix rows still sum to 1.0 ─────────────

  it('stressed matrix rows sum to 1.0', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const stressed = service.stressTransitionMatrix({
      baseMatrix: base.matrix,
      ratings: base.ratings,
      stressFactor: 3.0,
    });

    for (const row of stressed.stressedMatrix) {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 8);
    }
  });

  // ── 8. Multi-period projection conserves total exposure ───

  it('multi-period projection conserves total portfolio exposure', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const portfolio = [
      { rating: 'AAA', exposure: 100 },
      { rating: 'A', exposure: 200 },
      { rating: 'BBB', exposure: 300 },
    ];

    const result = service.projectCreditMigration({
      currentPortfolio: portfolio,
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 5,
    });

    const totalOriginal = portfolio.reduce((s, p) => s + p.exposure, 0);
    const totalProjected = result.projected.reduce((s, p) => s + p.exposure, 0);

    // Total exposure should be conserved (within rounding)
    expect(totalProjected).toBeCloseTo(totalOriginal, 0);
  });

  // ── 9. Cumulative PD increases with horizon ──────────────

  it('cumulative default probability increases with horizon', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const pd1 = service.estimateDefaultProbability({
      currentRating: 'BBB',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 1,
    });

    const pd5 = service.estimateDefaultProbability({
      currentRating: 'BBB',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 5,
    });

    const pd10 = service.estimateDefaultProbability({
      currentRating: 'BBB',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 10,
    });

    expect(pd5.cumulativePD).toBeGreaterThan(pd1.cumulativePD);
    expect(pd10.cumulativePD).toBeGreaterThan(pd5.cumulativePD);
    expect(pd1.marginalPDs).toHaveLength(1);
    expect(pd5.marginalPDs).toHaveLength(5);
    expect(pd10.marginalPDs).toHaveLength(10);
  });

  // ── 10. Survival probability = 1 - cumulative PD ────────

  it('survival probability equals 1 minus cumulative PD', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const result = service.estimateDefaultProbability({
      currentRating: 'B',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 3,
    });

    expect(result.survivalProbability).toBeCloseTo(1 - result.cumulativePD, 6);
    expect(result.cumulativePD).toBeGreaterThan(0);
    expect(result.survivalProbability).toBeLessThan(1);
  });

  // ── 11. Lower rated issuers have higher default probability ─

  it('lower rated issuers have higher cumulative PD', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const pdAAA = service.estimateDefaultProbability({
      currentRating: 'AAA',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 5,
    });

    const pdBBB = service.estimateDefaultProbability({
      currentRating: 'BBB',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 5,
    });

    const pdB = service.estimateDefaultProbability({
      currentRating: 'B',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 5,
    });

    expect(pdB.cumulativePD).toBeGreaterThan(pdBBB.cumulativePD);
    expect(pdBBB.cumulativePD).toBeGreaterThan(pdAAA.cumulativePD);
  });

  // ── 12. Stress factor < 1 decreases downgrade probability ──

  it('stress factor < 1 decreases downgrade probabilities', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const stressed = service.stressTransitionMatrix({
      baseMatrix: base.matrix,
      ratings: base.ratings,
      stressFactor: 0.5,
    });

    // For each non-default row, downgrade probability should decrease
    for (let i = 0; i < base.ratings.length - 1; i++) {
      let baseDowngrade = 0;
      let stressedDowngrade = 0;
      for (let j = i + 1; j < base.ratings.length; j++) {
        baseDowngrade += base.matrix[i][j];
        stressedDowngrade += stressed.stressedMatrix[i][j];
      }
      if (baseDowngrade > 0) {
        expect(stressedDowngrade).toBeLessThan(baseDowngrade);
      }
    }

    expect(stressed.avgDowngradeProbChange).toBeLessThan(0);
  });

  // ── 13. Projection with horizon=0 returns unchanged portfolio ─

  it('horizon=0 projection returns original portfolio', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const portfolio = [
      { rating: 'A', exposure: 500 },
      { rating: 'BB', exposure: 300 },
    ];

    const result = service.projectCreditMigration({
      currentPortfolio: portfolio,
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 0,
    });

    const aIdx = RATINGS.indexOf('A');
    const bbIdx = RATINGS.indexOf('BB');

    expect(result.projected[aIdx].exposure).toBeCloseTo(500, 0);
    expect(result.projected[bbIdx].exposure).toBeCloseTo(300, 0);
    expect(result.expectedLoss).toBe(0);
  });

  // ── 14. Marginal PDs sum to cumulative PD ─────────────────

  it('marginal PDs sum to cumulative PD', () => {
    const base = service.generateTransitionMatrix({ historicalRatings: [] });

    const result = service.estimateDefaultProbability({
      currentRating: 'BB',
      transitionMatrix: base.matrix,
      ratings: base.ratings,
      horizon: 7,
    });

    const sumMarginals = result.marginalPDs.reduce((a, b) => a + b, 0);
    expect(sumMarginals).toBeCloseTo(result.cumulativePD, 6);
  });
});
