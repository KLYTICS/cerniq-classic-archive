import { UassetUqualityUscoreService } from './asset-quality-score.service';

describe('UassetUqualityUscoreService', () => {
  const svc = new UassetUqualityUscoreService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
