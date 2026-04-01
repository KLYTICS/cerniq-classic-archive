import { UstressUlossUdistributionService } from './stress-loss-distribution.service';

describe('UstressUlossUdistributionService', () => {
  const svc = new UstressUlossUdistributionService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
