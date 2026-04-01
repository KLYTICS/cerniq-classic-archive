import { UfairUvalueUhierarchyService } from './fair-value-hierarchy.service';

describe('UfairUvalueUhierarchyService', () => {
  const svc = new UfairUvalueUhierarchyService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
