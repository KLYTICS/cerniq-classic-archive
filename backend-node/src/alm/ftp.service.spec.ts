import { FTPService } from './ftp.service';

describe('FTPService', () => {
  let service: FTPService;
  let prisma: any;
  let yieldCurveService: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: {
        findMany: jest.fn(),
      },
      yieldCurve: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    yieldCurveService = {};

    service = new FTPService(prisma, yieldCurveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getFTPAnalysis: basic asset/liability spread ───────────

  it('computes positive spread for assets yielding above FTP curve', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'High Yield Loan',
        category: 'asset',
        subcategory: 'commercial_loans',
        balance: 100,
        rate: 0.08, // 8% — well above Treasury curve
        duration: 5,
      },
    ]);

    const result = await service.getFTPAnalysis('inst_123');

    expect(result.instruments).toHaveLength(1);
    const inst = result.instruments[0];
    // 8% loan vs ~4.05% FTP for 5yr tenor => positive spread
    expect(inst.spread).toBeGreaterThan(0.03);
    expect(inst.spreadBps).toBeGreaterThan(300);
    expect(inst.contribution).toBeGreaterThan(0);
    expect(result.summary.totalAssetContribution).toBeGreaterThan(0);
  });

  // ── getFTPAnalysis: liability spread logic ────────────────

  it('computes positive spread for liabilities priced below FTP curve', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: '2',
        name: 'Savings Deposits',
        category: 'liability',
        subcategory: 'savings',
        balance: 200,
        rate: 0.01, // 1% — well below curve
        duration: 0.5,
      },
    ]);

    const result = await service.getFTPAnalysis('inst_123');

    const inst = result.instruments[0];
    // FTP rate for 0.5yr ~ 4.65%, liability rate 1% => spread = 4.65% - 1% > 0
    expect(inst.spread).toBeGreaterThan(0.03);
    expect(inst.contribution).toBeGreaterThan(0);
    expect(result.summary.totalLiabilityContribution).toBeGreaterThan(0);
  });

  // ── Segment aggregation ───────────────────────────────────

  it('aggregates instruments into segments by subcategory', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'Loan A',
        category: 'asset',
        subcategory: 'auto_loans',
        balance: 50,
        rate: 0.07,
        duration: 3,
      },
      {
        id: '2',
        name: 'Loan B',
        category: 'asset',
        subcategory: 'auto_loans',
        balance: 30,
        rate: 0.065,
        duration: 4,
      },
      {
        id: '3',
        name: 'Mortgage A',
        category: 'asset',
        subcategory: 'mortgages',
        balance: 100,
        rate: 0.055,
        duration: 7,
      },
    ]);

    const result = await service.getFTPAnalysis('inst_123');

    expect(result.instruments).toHaveLength(3);
    // Two segments: auto_loans and mortgages
    expect(result.segments).toHaveLength(2);

    const autoSeg = result.segments.find((s) => s.segment === 'auto_loans');
    expect(autoSeg).toBeDefined();
    expect(autoSeg!.instrumentCount).toBe(2);
    expect(autoSeg!.totalBalance).toBe(80);
  });

  // ── getNewProductPricing ──────────────────────────────────

  it('prices new products above the FTP curve with target spread', () => {
    const baseCurve = [
      { tenor: 1, rate: 0.044 },
      { tenor: 5, rate: 0.0405 },
      { tenor: 10, rate: 0.042 },
    ];

    const pricing = service.getNewProductPricing(baseCurve, [1, 5, 10]);

    expect(pricing).toHaveLength(3);
    for (const p of pricing) {
      // minimumRate = ftpRate + 150bps target spread
      expect(p.minimumRate).toBeCloseTo(p.ftpRate + 0.015, 4);
      // breakEvenRate = ftpRate + 50bps
      expect(p.breakEvenRate).toBeCloseTo(p.ftpRate + 0.005, 4);
      expect(p.targetSpread).toBe(0.015);
    }
    // 1yr tenor should match 4.4%
    expect(pricing[0].ftpRate).toBeCloseTo(0.044, 3);
  });

  // ── Spread adjustment parameter ───────────────────────────

  it('applies spread adjustment in basis points to FTP rates', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: '1',
        name: 'Loan',
        category: 'asset',
        subcategory: 'loans',
        balance: 100,
        rate: 0.06,
        duration: 5,
      },
    ]);

    const resultBase = await service.getFTPAnalysis('inst_123');
    const resultAdj = await service.getFTPAnalysis('inst_123', 50); // +50bps

    // With +50bps adjustment, the FTP rate goes up => asset spread decreases
    expect(resultAdj.instruments[0].ftpRate).toBeGreaterThan(
      resultBase.instruments[0].ftpRate,
    );
    expect(resultAdj.instruments[0].spread).toBeLessThan(
      resultBase.instruments[0].spread,
    );
  });
});
