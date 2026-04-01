import { UcapitalUplanningService } from './capital-planning.service';

describe('UcapitalUplanningService', () => {
  const svc = new UcapitalUplanningService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
