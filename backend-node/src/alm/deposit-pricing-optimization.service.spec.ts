import { UdepositUpricingUoptimizationService } from './deposit-pricing-optimization.service';

describe('UdepositUpricingUoptimizationService', () => {
  const svc = new UdepositUpricingUoptimizationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
