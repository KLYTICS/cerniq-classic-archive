import { NIMAttributionService } from './nim-attribution.service';

describe('NIMAttributionService', () => {
  let service: NIMAttributionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
    };
    service = new NIMAttributionService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Attribution with real balance sheet data ──────────────

  it('computes NIM and decomposes into 7 attribution factors', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Auto Loans',
        balance: 200,
        rate: 0.065,
        rateType: 'fixed',
      },
      {
        category: 'asset',
        subcategory: 'securities',
        name: 'Bond Portfolio',
        balance: 100,
        rate: 0.04,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        subcategory: 'savings',
        name: 'Savings',
        balance: 150,
        rate: 0.015,
        rateType: 'variable',
      },
      {
        category: 'liability',
        subcategory: 'cds',
        name: 'CDs',
        balance: 100,
        rate: 0.035,
        rateType: 'fixed',
      },
    ]);

    const result = await service.computeAttribution('inst_123');

    // NIM = (asset income - liability cost) / total assets * 100
    // Asset income = 200*0.065 + 100*0.04 = 17
    // Liability cost = 150*0.015 + 100*0.035 = 5.75
    // NIM = (17 - 5.75) / 300 * 100 = 3.75%
    expect(result.nimCurrent).toBeCloseTo(3.75, 1);
    expect(result.nimPrior).toBeDefined();
    expect(typeof result.nimDeltaBps).toBe('number');

    // 7 attribution factors
    expect(result.attribution).toHaveLength(7);

    // Expected factors
    const factorNames = result.attribution.map((f) => f.factor);
    expect(factorNames).toContain('Rate Environment');
    expect(factorNames).toContain('Deposit Beta');
    expect(factorNames).toContain('Volume Growth');
    expect(factorNames).toContain('Mix Shift');
    expect(factorNames).toContain('Repricing Lag');
    expect(factorNames).toContain('Prepayment Effect');
    expect(factorNames).toContain('Credit Quality');
  });

  // ── Attribution sums to approximately total delta ─────────

  it('total explained bps plus residual equals nimDeltaBps', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Loans',
        balance: 100,
        rate: 0.06,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: 'Deposits',
        balance: 80,
        rate: 0.02,
        rateType: 'variable',
      },
    ]);

    const result = await service.computeAttribution('inst_123');

    expect(result.totalExplainedBps + result.residualBps).toBe(
      result.nimDeltaBps,
    );
  });

  // ── Each factor has bilingual labels ──────────────────────

  it('provides Spanish translations for all attribution factors', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Prestamos',
        balance: 100,
        rate: 0.06,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: 'Depositos',
        balance: 80,
        rate: 0.02,
        rateType: 'variable',
      },
    ]);

    const result = await service.computeAttribution('inst_123');

    for (const factor of result.attribution) {
      expect(factor.factorEs).toBeDefined();
      expect(factor.factorEs.length).toBeGreaterThan(0);
      expect(factor.explanationEs).toBeDefined();
      expect(factor.explanationEs.length).toBeGreaterThan(0);
    }
  });

  // ── Direction labels correct ──────────────────────────────

  it('marks direction as positive, negative, or neutral based on bps', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Loans',
        balance: 500,
        rate: 0.07,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        subcategory: 'savings',
        name: 'Savings',
        balance: 400,
        rate: 0.01,
        rateType: 'variable',
      },
    ]);

    const result = await service.computeAttribution('inst_123');

    for (const factor of result.attribution) {
      if (factor.bps > 2) {
        expect(factor.direction).toBe('positive');
      } else if (factor.bps < -2) {
        expect(factor.direction).toBe('negative');
      } else {
        expect(factor.direction).toBe('neutral');
      }
    }
  });

  // ── Empty balance sheet triggers demo fallback ────────────

  it('returns a valid demo result when balance sheet is empty', async () => {
    // getDemoResult calls computeAttribution('demo') recursively.
    // On the first call (inst_123) items are empty => getDemoResult.
    // On the second call ('demo') we return sample data to stop recursion.
    let callCount = 0;
    prisma.balanceSheetItem.findMany.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([]);
      // Second call (from getDemoResult -> computeAttribution('demo'))
      return Promise.resolve([
        {
          category: 'asset',
          subcategory: 'loans',
          name: 'Demo Loan',
          balance: 100,
          rate: 0.06,
          rateType: 'fixed',
        },
        {
          category: 'liability',
          subcategory: 'deposits',
          name: 'Demo Deposit',
          balance: 80,
          rate: 0.02,
          rateType: 'variable',
        },
      ]);
    });

    const result = await service.computeAttribution('inst_123');

    // The demo fallback should still return a valid structure
    expect(result).toBeDefined();
    expect(typeof result.nimCurrent).toBe('number');
    expect(typeof result.nimPrior).toBe('number');
  });
});
