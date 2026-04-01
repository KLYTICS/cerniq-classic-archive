import { UportfolioUrebalancingService } from './portfolio-rebalancing.service';

describe('UportfolioUrebalancingService', () => {
  const svc = new UportfolioUrebalancingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
