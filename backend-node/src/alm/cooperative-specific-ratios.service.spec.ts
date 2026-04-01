import { UcooperativeUspecificUratiosService } from './cooperative-specific-ratios.service';

describe('UcooperativeUspecificUratiosService', () => {
  const svc = new UcooperativeUspecificUratiosService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
