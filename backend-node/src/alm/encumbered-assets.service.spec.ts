import {
  EncumberedAssetsService,
  EncumberedAssetsParams,
} from './encumbered-assets.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const BASE_PARAMS: EncumberedAssetsParams = {
  assets: [
    {
      name: 'MBS Portfolio',
      balance: 50_000_000,
      encumbered: 30_000_000,
      pledgedTo: 'FHLB',
    },
    {
      name: 'Treasury Securities',
      balance: 30_000_000,
      encumbered: 10_000_000,
      pledgedTo: 'Fed Discount Window',
    },
    {
      name: 'Commercial Loans',
      balance: 40_000_000,
      encumbered: 0,
      pledgedTo: '',
    },
    {
      name: 'Auto Loan Pool',
      balance: 20_000_000,
      encumbered: 15_000_000,
      pledgedTo: 'FHLB',
    },
    { name: 'Cash', balance: 10_000_000, encumbered: 0, pledgedTo: '' },
  ],
};

describe('EncumberedAssetsService', () => {
  let svc: EncumberedAssetsService;

  beforeEach(() => {
    svc = new EncumberedAssetsService();
  });

  // ─── Test 1: Total assets computed correctly ─────────────────────

  it('should compute total assets as sum of all balances', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.totalAssets).toBe(150_000_000);
  });

  // ─── Test 2: Encumbered assets summed correctly ──────────────────

  it('should compute total encumbered assets', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.encumberedAssets).toBe(55_000_000);
  });

  // ─── Test 3: Unencumbered = total - encumbered ───────────────────

  it('should compute unencumbered assets as total minus encumbered', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.unencumberedAssets).toBe(95_000_000);
    expect(result.availableCollateral).toBe(95_000_000);
  });

  // ─── Test 4: Encumbrance ratio computed correctly ────────────────

  it('should compute encumbrance ratio as encumbered / total', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.encumbranceRatio).toBeCloseTo(55_000_000 / 150_000_000, 4);
  });

  // ─── Test 5: Pledgee breakdown aggregates correctly ──────────────

  it('should aggregate encumbered amounts by pledgee', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.byPledgee).toHaveLength(2);
    const fhlb = result.byPledgee.find((p) => p.pledgee === 'FHLB')!;
    expect(fhlb.encumberedAmount).toBe(45_000_000); // 30M + 15M
    const fed = result.byPledgee.find(
      (p) => p.pledgee === 'Fed Discount Window',
    )!;
    expect(fed.encumberedAmount).toBe(10_000_000);
  });

  // ─── Test 6: Pledgee percentages sum to 1 ───────────────────────

  it('should have pledgee percentages summing to approximately 1', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    const totalPct = result.byPledgee.reduce((s, p) => s + p.percentage, 0);
    expect(totalPct).toBeCloseTo(1.0, 4);
  });

  // ─── Test 7: Sorted by largest pledgee first ────────────────────

  it('should sort pledgees by descending encumbered amount', () => {
    const result = svc.analyzeEncumbrance(BASE_PARAMS);
    expect(result.byPledgee[0].pledgee).toBe('FHLB');
    expect(result.byPledgee[0].encumberedAmount).toBeGreaterThan(
      result.byPledgee[1].encumberedAmount,
    );
  });

  // ─── Test 8: Throws on empty assets ──────────────────────────────

  it('should throw when no assets are provided', () => {
    expect(() => svc.analyzeEncumbrance({ assets: [] })).toThrow(
      'At least one asset entry',
    );
  });

  // ─── Test 9: Validation detects over-encumbrance ─────────────────

  it('should detect when encumbered exceeds balance', () => {
    const params: EncumberedAssetsParams = {
      assets: [
        {
          name: 'Bad Asset',
          balance: 10_000_000,
          encumbered: 15_000_000,
          pledgedTo: 'FHLB',
        },
      ],
    };
    const result = svc.validateEncumbrance(params);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('exceeds balance');
  });

  // ─── Test 10: Validation passes for clean data ──────────────────

  it('should validate clean data without errors', () => {
    const result = svc.validateEncumbrance(BASE_PARAMS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ─── Test 11: Fully unencumbered portfolio ──────────────────────

  it('should handle a portfolio with zero encumbrance', () => {
    const params: EncumberedAssetsParams = {
      assets: [
        { name: 'Cash', balance: 50_000_000, encumbered: 0, pledgedTo: '' },
        { name: 'Bonds', balance: 30_000_000, encumbered: 0, pledgedTo: '' },
      ],
    };
    const result = svc.analyzeEncumbrance(params);
    expect(result.encumbranceRatio).toBe(0);
    expect(result.unencumberedAssets).toBe(80_000_000);
    expect(result.byPledgee).toHaveLength(0);
  });
});
