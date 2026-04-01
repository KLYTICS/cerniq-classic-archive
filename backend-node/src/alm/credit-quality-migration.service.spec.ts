import { UcreditUqualityUmigrationService } from './credit-quality-migration.service';

describe('UcreditUqualityUmigrationService', () => {
  const svc = new UcreditUqualityUmigrationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
