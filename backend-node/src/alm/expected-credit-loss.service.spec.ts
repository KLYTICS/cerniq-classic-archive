import { UexpectedUcreditUlossService } from './expected-credit-loss.service';

describe('UexpectedUcreditUlossService', () => {
  const svc = new UexpectedUcreditUlossService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
