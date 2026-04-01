import { UliquidityUbufferUsizingService } from './liquidity-buffer-sizing.service';

describe('UliquidityUbufferUsizingService', () => {
  const svc = new UliquidityUbufferUsizingService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
