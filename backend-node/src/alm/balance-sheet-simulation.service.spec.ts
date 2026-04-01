import { UbalanceUsheetUsimulationService } from './balance-sheet-simulation.service';

describe('UbalanceUsheetUsimulationService', () => {
  const svc = new UbalanceUsheetUsimulationService();

  it('analyze returns result with interpretation', () => {
    const r = svc.analyze({ test: 1 });
    expect(r.result).toEqual({ test: 1 });
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });
});
