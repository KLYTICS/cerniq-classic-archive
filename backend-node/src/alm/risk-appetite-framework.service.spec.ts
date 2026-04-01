import { UriskUappetiteUframeworkService } from './risk-appetite-framework.service';

describe('UriskUappetiteUframeworkService', () => {
  const svc = new UriskUappetiteUframeworkService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
