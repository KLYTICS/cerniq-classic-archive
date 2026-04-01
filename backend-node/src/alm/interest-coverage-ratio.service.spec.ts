import { UinterestUcoverageUratioService } from './interest-coverage-ratio.service';

describe('UinterestUcoverageUratioService', () => {
  const svc = new UinterestUcoverageUratioService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
