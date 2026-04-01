import { UdividendUcapacityService } from './dividend-capacity.service';

describe('UdividendUcapacityService', () => {
  const svc = new UdividendUcapacityService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
