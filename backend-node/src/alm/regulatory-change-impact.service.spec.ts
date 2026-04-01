import { UregulatoryUchangeUimpactService } from './regulatory-change-impact.service';

describe('UregulatoryUchangeUimpactService', () => {
  const svc = new UregulatoryUchangeUimpactService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
