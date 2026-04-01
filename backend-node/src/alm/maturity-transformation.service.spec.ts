import { UmaturityUtransformationService } from './maturity-transformation.service';

describe('UmaturityUtransformationService', () => {
  const svc = new UmaturityUtransformationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
