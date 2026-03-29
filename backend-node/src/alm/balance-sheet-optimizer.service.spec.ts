import { UbalanceUsheetUoptimizerService } from './balance-sheet-optimizer.service';

describe('UbalanceUsheetUoptimizerService', () => {
  let service: UbalanceUsheetUoptimizerService;

  beforeEach(() => {
    service = new UbalanceUsheetUoptimizerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return result, interpretation, and interpretationEs', () => {
    const params = { totalAssets: 500, roe: 0.12 };
    const output = service.analyze(params);
    expect(output).toHaveProperty('result');
    expect(output).toHaveProperty('interpretation');
    expect(output).toHaveProperty('interpretationEs');
  });

  it('should echo the input params in result', () => {
    const params = { totalAssets: 1000, equityRatio: 0.08 };
    const output = service.analyze(params);
    expect(output.result).toEqual(params);
  });

  it('should return English interpretation string', () => {
    const output = service.analyze({ x: 1 });
    expect(output.interpretation).toBe(
      'Optimal balance sheet structure for ROE',
    );
  });

  it('should return Spanish interpretation string', () => {
    const output = service.analyze({ x: 1 });
    expect(output.interpretationEs).toBe(
      'Optimal balance sheet structure for ROE',
    );
  });
});
