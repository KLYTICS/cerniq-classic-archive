import { UloanUpricingUmodelService } from './loan-pricing-model.service';

describe('UloanUpricingUmodelService', () => {
  const svc = new UloanUpricingUmodelService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
