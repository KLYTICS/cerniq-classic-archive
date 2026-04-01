import { UrateUsensitivityUprofileService } from './rate-sensitivity-profile.service';

describe('UrateUsensitivityUprofileService', () => {
  const svc = new UrateUsensitivityUprofileService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
