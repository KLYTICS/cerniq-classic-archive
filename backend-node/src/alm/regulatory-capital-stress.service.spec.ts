import { UregulatoryUcapitalUstressService } from './regulatory-capital-stress.service';

describe('UregulatoryUcapitalUstressService', () => {
  const svc = new UregulatoryUcapitalUstressService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
