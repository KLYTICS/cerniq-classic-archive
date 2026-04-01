import { UincomeUvolatilityService } from './income-volatility.service';

describe('UincomeUvolatilityService', () => {
  const svc = new UincomeUvolatilityService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
