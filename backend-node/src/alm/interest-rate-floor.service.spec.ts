import { UinterestUrateUfloorService } from './interest-rate-floor.service';

describe('UinterestUrateUfloorService', () => {
  const svc = new UinterestUrateUfloorService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
