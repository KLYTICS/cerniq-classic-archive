import { UcreditUcycleUindicatorService } from './credit-cycle-indicator.service';

describe('UcreditUcycleUindicatorService', () => {
  const svc = new UcreditUcycleUindicatorService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
