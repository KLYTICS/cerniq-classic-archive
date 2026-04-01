import { UcreditUlossUforecasterService } from './credit-loss-forecaster.service';

describe('UcreditUlossUforecasterService', () => {
  const svc = new UcreditUlossUforecasterService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
