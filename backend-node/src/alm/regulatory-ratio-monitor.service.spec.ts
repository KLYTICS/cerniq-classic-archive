import { UregulatoryUratioUmonitorService } from './regulatory-ratio-monitor.service';

describe('UregulatoryUratioUmonitorService', () => {
  const svc = new UregulatoryUratioUmonitorService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
