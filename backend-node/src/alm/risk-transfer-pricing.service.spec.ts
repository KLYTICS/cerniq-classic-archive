import { UriskUtransferUpricingService } from './risk-transfer-pricing.service';

describe('UriskUtransferUpricingService', () => {
  const svc = new UriskUtransferUpricingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
