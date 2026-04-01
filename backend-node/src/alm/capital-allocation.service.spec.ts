import { UcapitalUallocationService } from './capital-allocation.service';

describe('UcapitalUallocationService', () => {
  const svc = new UcapitalUallocationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
