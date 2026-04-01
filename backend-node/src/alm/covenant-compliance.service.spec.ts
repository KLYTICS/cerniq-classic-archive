import { UcovenantUcomplianceService } from './covenant-compliance.service';

describe('UcovenantUcomplianceService', () => {
  const svc = new UcovenantUcomplianceService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
