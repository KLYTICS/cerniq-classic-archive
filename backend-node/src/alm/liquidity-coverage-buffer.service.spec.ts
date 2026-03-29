import { UliquidityUcoverageUbufferService } from './liquidity-coverage-buffer.service';

describe('UliquidityUcoverageUbufferService', () => {
  let service: UliquidityUcoverageUbufferService;

  beforeEach(() => {
    service = new UliquidityUcoverageUbufferService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return correct output shape', () => {
    const output = service.analyze({ hqla: 200, netOutflows: 150 });
    expect(output).toHaveProperty('result');
    expect(output).toHaveProperty('interpretation');
    expect(output).toHaveProperty('interpretationEs');
  });

  it('should pass through params as result', () => {
    const params = { hqla: 500, netOutflows: 300, lcr: 166.7 };
    const output = service.analyze(params);
    expect(output.result).toEqual(params);
  });

  it('should provide HQLA sufficiency interpretation in English', () => {
    const output = service.analyze({});
    expect(output.interpretation).toBe('HQLA sufficiency analysis');
  });

  it('should provide HQLA sufficiency interpretation in Spanish', () => {
    const output = service.analyze({});
    expect(output.interpretationEs).toBe('HQLA sufficiency analysis');
  });
});
