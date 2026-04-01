import { UmemberUconcentrationService } from './member-concentration.service';

describe('UmemberUconcentrationService', () => {
  const svc = new UmemberUconcentrationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
