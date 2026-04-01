import { RegulatoryCapitalBufferService } from './regulatory-capital-buffer.service';

describe('RegulatoryCapitalBufferService', () => {
  const svc = new RegulatoryCapitalBufferService();

  it('analyze returns buffer calculations with interpretation', () => {
    const r = svc.analyze({
      capitalRatio: 12,
      minimumRatio: 7,
      totalAssets: 1_000_000,
      quarterlyEarnings: 10_000,
      stressedLossRate: 2,
    });
    expect(r.currentBuffer).toBe(5);
    expect(r.bufferDollars).toBeGreaterThan(0);
    expect(r.runwayQuarters).toBeGreaterThan(0);
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });

  it('returns zero buffer when at minimum capital', () => {
    const r = svc.analyze({
      capitalRatio: 7,
      minimumRatio: 7,
      totalAssets: 500_000,
      quarterlyEarnings: 5_000,
      stressedLossRate: 1,
    });
    expect(r.currentBuffer).toBe(0);
    expect(r.bufferDollars).toBe(0);
  });
});
