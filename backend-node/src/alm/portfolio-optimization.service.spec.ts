import { UportfolioUoptimizationService } from './portfolio-optimization.service';

describe('UportfolioUoptimizationService', () => {
  const svc = new UportfolioUoptimizationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
