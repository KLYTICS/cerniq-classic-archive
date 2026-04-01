import { UassetUliabilityUmismatchService } from './asset-liability-mismatch.service';

describe('UassetUliabilityUmismatchService', () => {
  const svc = new UassetUliabilityUmismatchService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
