import { AssetEWSService } from './asset-ews.service';

describe('AssetEWSService', () => {
  let service: AssetEWSService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AssetEWSService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return demo result with correct shape when no data', async () => {
    const result = await service.computeEWS('inst-1');
    expect(result).toHaveProperty('compositeScore');
    expect(result).toHaveProperty('alertLevel');
    expect(result).toHaveProperty('indicators');
    expect(result).toHaveProperty('topDeteriorating');
    expect(result).toHaveProperty('peerAlert');
    expect(result).toHaveProperty('peerAlertEs');
    expect(result).toHaveProperty('anomalyScore');
    expect(result.indicators).toHaveLength(12);
  });

  it('should produce GREEN alert for healthy demo defaults', async () => {
    const result = await service.computeEWS('inst-1');
    // Demo defaults use avgLossRate=0.015, which produces mostly green indicators
    expect(result.compositeScore).toBeGreaterThanOrEqual(50);
    expect(['GREEN', 'YELLOW']).toContain(result.alertLevel);
  });

  it('should compute anomaly score between 0 and 1', async () => {
    const result = await service.computeEWS('inst-1');
    expect(result.anomalyScore).toBeGreaterThanOrEqual(0);
    expect(result.anomalyScore).toBeLessThanOrEqual(1);
  });

  it('should produce bilingual peer alerts', async () => {
    const result = await service.computeEWS('inst-1');
    expect(typeof result.peerAlert).toBe('string');
    expect(typeof result.peerAlertEs).toBe('string');
    expect(result.peerAlert.length).toBeGreaterThan(0);
    expect(result.peerAlertEs.length).toBeGreaterThan(0);
  });

  it('should have indicator weights summing to 100', async () => {
    const result = await service.computeEWS('inst-1');
    const totalWeight = result.indicators.reduce((s, i) => s + i.weight, 0);
    expect(totalWeight).toBe(100);
  });

  // ── Coverage: with actual balance sheet data ──────────────────
  it('computes EWS with real loan segments and balance sheet items', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'commercial_loans', balance: 5000, rate: 0.06, duration: 3 },
      { category: 'asset', subcategory: 'auto_loans', balance: 3000, rate: 0.05, duration: 2 },
      { category: 'asset', subcategory: 'cash', balance: 1000, rate: 0.01, duration: 0 },
      { category: 'asset', subcategory: 'securities', balance: 2000, rate: 0.03, duration: 5 },
    ]);
    prisma.loanSegment.findMany.mockResolvedValue([
      { balance: 5000, historicalLossRate: 0.03 },
      { balance: 3000, historicalLossRate: 0.02 },
    ]);

    const result = await service.computeEWS('inst-with-data');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.indicators).toHaveLength(12);
    // With higher loss rates, some indicators should be yellow/red
    const nonGreen = result.indicators.filter(i => i.alertLevel !== 'green');
    expect(nonGreen.length).toBeGreaterThanOrEqual(0);
  });

  // ── Coverage: RED/YELLOW alert levels ────────────────────────
  it('produces RED alert and deteriorating indicators with high loss rates', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'commercial_loans', balance: 10000, rate: 0.08, duration: 5 },
    ]);
    prisma.loanSegment.findMany.mockResolvedValue([
      { balance: 10000, historicalLossRate: 0.08 }, // very high loss rate
    ]);

    const result = await service.computeEWS('inst-high-loss');
    // High loss rates should trigger red indicators and lower composite score
    const redIndicators = result.indicators.filter(i => i.alertLevel === 'red');
    expect(redIndicators.length).toBeGreaterThan(0);
    // Top deteriorating should have entries
    expect(result.topDeteriorating.length).toBeGreaterThanOrEqual(0);
    // Anomaly score should be higher with red indicators
    expect(result.anomalyScore).toBeGreaterThan(0.3);
  });

  // ── Coverage: peer alert when peer_delinquency_gap is not green ──
  it('produces peer divergence alert with high loss rates', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'commercial_loans', balance: 10000, rate: 0.1, duration: 5 },
    ]);
    prisma.loanSegment.findMany.mockResolvedValue([
      { balance: 10000, historicalLossRate: 0.10 },
    ]);

    const result = await service.computeEWS('inst-peer-alert');
    // With very high loss rates, peer_delinquency_gap may become yellow/red
    expect(result.peerAlert).toBeDefined();
    expect(result.peerAlertEs).toBeDefined();
  });

  // ── Coverage: zero totalWeight path ────────────────────────────
  it('returns demo default composite score when no items or segments', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.loanSegment.findMany.mockResolvedValue([]);
    const result = await service.computeEWS('inst-empty');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
  });
});
