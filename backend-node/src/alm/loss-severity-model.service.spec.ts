import { UlossUseverityUmodelService } from './loss-severity-model.service';

describe('UlossUseverityUmodelService', () => {
  const svc = new UlossUseverityUmodelService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
