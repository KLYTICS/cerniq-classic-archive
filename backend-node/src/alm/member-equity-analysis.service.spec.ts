import { UmemberUequityUanalysisService } from './member-equity-analysis.service';

describe('UmemberUequityUanalysisService', () => {
  const svc = new UmemberUequityUanalysisService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
