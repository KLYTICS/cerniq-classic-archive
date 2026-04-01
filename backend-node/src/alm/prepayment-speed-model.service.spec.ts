import { UprepaymentUspeedUmodelService } from './prepayment-speed-model.service';

describe('UprepaymentUspeedUmodelService', () => {
  const svc = new UprepaymentUspeedUmodelService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
