import { UboardUriskUreportService } from './board-risk-report.service';

describe('UboardUriskUreportService', () => {
  const svc = new UboardUriskUreportService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
