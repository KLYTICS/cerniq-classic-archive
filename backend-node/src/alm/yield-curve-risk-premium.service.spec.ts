import { UyieldUcurveUriskUpremiumService } from './yield-curve-risk-premium.service';

describe('UyieldUcurveUriskUpremiumService', () => {
  const svc = new UyieldUcurveUriskUpremiumService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
