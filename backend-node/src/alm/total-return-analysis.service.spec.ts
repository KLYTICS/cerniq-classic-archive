import { UtotalUreturnUanalysisService } from './total-return-analysis.service';

describe('UtotalUreturnUanalysisService', () => {
  const svc = new UtotalUreturnUanalysisService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
