import { UfundingUcostUallocationService } from './funding-cost-allocation.service';

describe('UfundingUcostUallocationService', () => {
  const svc = new UfundingUcostUallocationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
