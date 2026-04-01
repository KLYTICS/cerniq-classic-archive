import { UalmUgapUattributionService } from './alm-gap-attribution.service';

describe('UalmUgapUattributionService', () => {
  const svc = new UalmUgapUattributionService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
