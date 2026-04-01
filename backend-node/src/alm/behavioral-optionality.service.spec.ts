import { UbehavioralUoptionalityService } from './behavioral-optionality.service';

describe('UbehavioralUoptionalityService', () => {
  const svc = new UbehavioralUoptionalityService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
