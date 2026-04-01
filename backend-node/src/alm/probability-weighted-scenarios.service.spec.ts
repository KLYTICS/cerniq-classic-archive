import { UprobabilityUweightedUscenariosService } from './probability-weighted-scenarios.service';

describe('UprobabilityUweightedUscenariosService', () => {
  const svc = new UprobabilityUweightedUscenariosService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
