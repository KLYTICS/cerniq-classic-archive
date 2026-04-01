import { UregulatoryUearlyUwarningService } from './regulatory-early-warning.service';

describe('UregulatoryUearlyUwarningService', () => {
  const svc = new UregulatoryUearlyUwarningService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
