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
});
