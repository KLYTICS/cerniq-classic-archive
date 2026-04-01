import { UcashUflowUmatchingService } from './cash-flow-matching.service';

describe('UcashUflowUmatchingService', () => {
  const svc = new UcashUflowUmatchingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
