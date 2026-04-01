import { UscenarioUseverityUrankingService } from './scenario-severity-ranking.service';

describe('UscenarioUseverityUrankingService', () => {
  const svc = new UscenarioUseverityUrankingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
