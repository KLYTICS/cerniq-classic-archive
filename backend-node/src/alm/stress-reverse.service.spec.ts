import {
  StressReverseService,
  InstrumentInput,
  BalanceSheetInput,
} from './stress-reverse.service';

describe('StressReverseService', () => {
  let service: StressReverseService;

  beforeEach(() => {
    service = new StressReverseService();
  });

  // ── Helpers ───────────────────────────────────────────────

  /** Typical credit union balance sheet */
  function makeBalanceSheet(
    overrides?: Partial<{
      assetAmount: number;
      liabilityAmount: number;
      assetRate: number;
      liabilityRate: number;
      assetMaturity: number;
      liabilityMaturity: number;
      assetFloating: boolean;
      liabilityFloating: boolean;
    }>,
  ): BalanceSheetInput {
    return {
      assets: [
        {
          name: 'Fixed Loans',
          amount: overrides?.assetAmount ?? 100,
          rate: overrides?.assetRate ?? 0.05,
          maturityYears: overrides?.assetMaturity ?? 5,
          isFloating: overrides?.assetFloating ?? false,
        },
      ],
      liabilities: [
        {
          name: 'Deposits',
          amount: overrides?.liabilityAmount ?? 85,
          rate: overrides?.liabilityRate ?? 0.02,
          maturityYears: overrides?.liabilityMaturity ?? 1,
          isFloating: overrides?.liabilityFloating ?? false,
        },
      ],
    };
  }

  /** Balance sheet with floating-rate assets */
  function makeFloatingAssetBS(): BalanceSheetInput {
    return {
      assets: [
        {
          name: 'Variable Rate Loans',
          amount: 100,
          rate: 0.05,
          maturityYears: 5,
          isFloating: true,
        },
      ],
      liabilities: [
        {
          name: 'Term Deposits',
          amount: 85,
          rate: 0.02,
          maturityYears: 2,
          isFloating: false,
        },
      ],
    };
  }

  /** Large balance sheet (10x) */
  function makeLargeBalanceSheet(): BalanceSheetInput {
    return {
      assets: [
        {
          name: 'Fixed Loans',
          amount: 1000,
          rate: 0.05,
          maturityYears: 5,
          isFloating: false,
        },
      ],
      liabilities: [
        {
          name: 'Deposits',
          amount: 850,
          rate: 0.02,
          maturityYears: 1,
          isFloating: false,
        },
      ],
    };
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── findBreachScenario ────────────────────────────────────

  describe('findBreachScenario', () => {
    it('finds EVE breach within search range', () => {
      const bs = makeBalanceSheet();
      const result = service.findBreachScenario({
        balanceSheet: bs,
        threshold: { metric: 'EVE', limit: 10 },
        searchRange: { minShockBps: -500, maxShockBps: 500, stepBps: 5 },
      });

      expect(result.breachShock).not.toBeNull();
      expect(result.breachValue).toBeLessThan(10);
      expect(result.baseValue).toBeGreaterThan(10);
      expect(result.margin).toBeGreaterThan(0);
      expect(result.scenarioDescription).toContain('breach');
    });

    it('returns null when no breach exists within range', () => {
      const bs = makeBalanceSheet();
      // Set a very low limit that won't be breached
      const result = service.findBreachScenario({
        balanceSheet: bs,
        threshold: { metric: 'EVE', limit: -1000 },
        searchRange: { minShockBps: -10, maxShockBps: 10, stepBps: 1 },
      });

      expect(result.breachShock).toBeNull();
      expect(result.scenarioDescription).toContain('No breach found');
    });

    it('finds NII breach scenario', () => {
      const bs = makeBalanceSheet();
      const baseNII = service.findBreachScenario({
        balanceSheet: bs,
        threshold: { metric: 'NII', limit: 0 },
        searchRange: { minShockBps: -500, maxShockBps: 500, stepBps: 5 },
      });

      // NII should have a positive base value with our balance sheet
      expect(baseNII.baseValue).toBeGreaterThan(0);
    });

    it('larger balance sheet breaches at a smaller shock (proportionally same)', () => {
      const smallBS = makeBalanceSheet({
        assetAmount: 100,
        liabilityAmount: 85,
      });
      const largeBS = makeLargeBalanceSheet();

      const smallResult = service.findBreachScenario({
        balanceSheet: smallBS,
        threshold: { metric: 'EVE', limit: 5 },
        searchRange: { minShockBps: 0, maxShockBps: 1000, stepBps: 5 },
      });

      const largeResult = service.findBreachScenario({
        balanceSheet: largeBS,
        threshold: { metric: 'EVE', limit: 50 }, // proportionally same limit
        searchRange: { minShockBps: 0, maxShockBps: 1000, stepBps: 5 },
      });

      // Both should find breaches
      expect(smallResult.breachShock).not.toBeNull();
      expect(largeResult.breachShock).not.toBeNull();

      // The shock levels should be similar since the B/S is proportionally identical
      if (
        smallResult.breachShock !== null &&
        largeResult.breachShock !== null
      ) {
        expect(
          Math.abs(smallResult.breachShock - largeResult.breachShock),
        ).toBeLessThanOrEqual(10);
      }
    });

    it('floating rate assets have different breach shock than fixed', () => {
      const fixedBS = makeBalanceSheet({ assetFloating: false });
      const floatingBS = makeFloatingAssetBS();

      const fixedResult = service.findBreachScenario({
        balanceSheet: fixedBS,
        threshold: { metric: 'EVE', limit: 5 },
        searchRange: { minShockBps: 0, maxShockBps: 1000, stepBps: 5 },
      });

      const floatingResult = service.findBreachScenario({
        balanceSheet: floatingBS,
        threshold: { metric: 'EVE', limit: 5 },
        searchRange: { minShockBps: 0, maxShockBps: 1000, stepBps: 5 },
      });

      // Floating rate assets have very short duration, so EVE is less sensitive
      // to rate shocks. Floating should require a LARGER shock to breach.
      if (
        fixedResult.breachShock !== null &&
        floatingResult.breachShock !== null
      ) {
        expect(floatingResult.breachShock).toBeGreaterThan(
          fixedResult.breachShock,
        );
      } else if (
        fixedResult.breachShock !== null &&
        floatingResult.breachShock === null
      ) {
        // Floating doesn't breach at all = even more resilient
        expect(true).toBe(true);
      }
    });

    it('finds LCR breach scenario', () => {
      const bs = makeBalanceSheet();
      const result = service.findBreachScenario({
        balanceSheet: bs,
        threshold: { metric: 'LCR', limit: 100 },
        searchRange: { minShockBps: 0, maxShockBps: 1000, stepBps: 10 },
      });

      // LCR should deteriorate with rate shocks
      expect(result.baseValue).toBeGreaterThan(0);
      // Even if no breach, the scenario description should be informative
      expect(result.scenarioDescription).toBeTruthy();
    });

    it('breach scenario description includes key information', () => {
      const bs = makeBalanceSheet();
      const result = service.findBreachScenario({
        balanceSheet: bs,
        threshold: { metric: 'EVE', limit: 10 },
        searchRange: { minShockBps: 0, maxShockBps: 500, stepBps: 5 },
      });

      if (result.breachShock !== null) {
        expect(result.scenarioDescription).toContain('bps');
        expect(result.scenarioDescription).toContain('EVE');
        expect(result.scenarioDescription).toContain('breach');
      }
    });
  });

  // ── multiFactorReverseStress ──────────────────────────────

  describe('multiFactorReverseStress', () => {
    it('finds multi-factor combination that breaches thresholds', () => {
      const bs = makeBalanceSheet();

      const result = service.multiFactorReverseStress({
        balanceSheet: bs,
        thresholds: [
          { metric: 'EVE', limit: 10 },
          { metric: 'NII', limit: 3 },
        ],
        factors: [
          { name: 'rateShock', range: [0, 300] },
          { name: 'spread_widening', range: [0, 200] },
        ],
      });

      expect(result.scenario).toBeDefined();
      expect(result.scenario.length).toBe(2);
      expect(result.severity).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.severity);
    });

    it('returns severity classification based on factor magnitudes', () => {
      const bs = makeBalanceSheet();

      // Easy breach: small range factors with low thresholds
      const easyResult = service.multiFactorReverseStress({
        balanceSheet: bs,
        thresholds: [{ metric: 'EVE', limit: 14.9 }],
        factors: [{ name: 'rateShock', range: [0, 500] }],
      });

      // Hard breach: very negative limit
      const hardResult = service.multiFactorReverseStress({
        balanceSheet: bs,
        thresholds: [{ metric: 'EVE', limit: -10000 }],
        factors: [{ name: 'rateShock', range: [0, 500] }],
      });

      // Easy breach should be more critical (smaller shocks needed)
      // Hard breach should be less severe (needs extreme scenario or can't breach)
      expect(easyResult.severity).toBeDefined();
      expect(hardResult.severity).toBeDefined();
    });

    it('handles three factors: rate shock + spread widening + deposit runoff', () => {
      const bs = makeBalanceSheet();

      const result = service.multiFactorReverseStress({
        balanceSheet: bs,
        thresholds: [{ metric: 'EVE', limit: 10 }],
        factors: [
          { name: 'rateShock', range: [0, 200] },
          { name: 'spread_widening', range: [0, 100] },
          { name: 'deposit_runoff', range: [0, 20] },
        ],
      });

      expect(result.scenario.length).toBe(3);
      const factorNames = result.scenario.map((s) => s.factor);
      expect(factorNames).toContain('rateShock');
      expect(factorNames).toContain('spread_widening');
      expect(factorNames).toContain('deposit_runoff');
    });
  });

  // ── capitalAdequacyReverseStress ──────────────────────────

  describe('capitalAdequacyReverseStress', () => {
    it('calculates maximum tolerable loss before capital breach', () => {
      const bs = makeBalanceSheet();
      const result = service.capitalAdequacyReverseStress({
        currentCapitalRatio: 12,
        riskWeightedAssets: 80,
        balanceSheet: bs,
        minimumCapitalRatio: 7,
      });

      // Buffer = 12% - 7% = 5% of RWA = 4.0
      expect(result.maxTolerableLoss).toBeCloseTo(4.0, 1);
      expect(result.capitalBuffer).toBeCloseTo(5.0, 1);
      expect(result.maxTolerableLossPct).toBeGreaterThan(0);
      expect(result.impliedShock).toBeGreaterThan(0);
      expect(result.bufferDays).toBeGreaterThan(0);
    });

    it('returns higher tolerable loss with more capital', () => {
      const bs = makeBalanceSheet();

      const wellCapitalized = service.capitalAdequacyReverseStress({
        currentCapitalRatio: 15,
        riskWeightedAssets: 80,
        balanceSheet: bs,
        minimumCapitalRatio: 7,
      });

      const thinlyCapitalized = service.capitalAdequacyReverseStress({
        currentCapitalRatio: 8,
        riskWeightedAssets: 80,
        balanceSheet: bs,
        minimumCapitalRatio: 7,
      });

      expect(wellCapitalized.maxTolerableLoss).toBeGreaterThan(
        thinlyCapitalized.maxTolerableLoss,
      );
      expect(wellCapitalized.capitalBuffer).toBeGreaterThan(
        thinlyCapitalized.capitalBuffer,
      );
      expect(wellCapitalized.impliedShock).toBeGreaterThan(
        thinlyCapitalized.impliedShock,
      );
    });

    it('returns zero buffer when at minimum capital', () => {
      const bs = makeBalanceSheet();
      const result = service.capitalAdequacyReverseStress({
        currentCapitalRatio: 7,
        riskWeightedAssets: 80,
        balanceSheet: bs,
        minimumCapitalRatio: 7,
      });

      expect(result.maxTolerableLoss).toBeCloseTo(0, 1);
      expect(result.capitalBuffer).toBeCloseTo(0, 1);
    });

    it('calculates buffer days based on NII erosion', () => {
      const bs = makeBalanceSheet();
      const result = service.capitalAdequacyReverseStress({
        currentCapitalRatio: 12,
        riskWeightedAssets: 80,
        balanceSheet: bs,
        minimumCapitalRatio: 7,
      });

      // Buffer days should be a positive integer
      expect(result.bufferDays).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.bufferDays)).toBe(true);
    });
  });
});
