import { UpeerUrankingService } from './peer-ranking.service';

describe('UpeerUrankingService', () => {
  const svc = new UpeerUrankingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
