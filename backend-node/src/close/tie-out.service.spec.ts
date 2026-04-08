import { TieOutService } from './tie-out.service';
import { ReconciliationStatus } from '@prisma/client';

describe('TieOutService', () => {
  let svc: TieOutService;

  beforeEach(() => {
    svc = new TieOutService();
  });

  it('returns TIE when balances match and there are no lines', () => {
    const result = svc.run(1000, 1000, []);
    expect(result.status).toBe(ReconciliationStatus.TIE);
    expect(result.difference).toBe(0);
    expect(result.unmatched).toHaveLength(0);
    expect(result.matchedPairs).toHaveLength(0);
  });

  it('returns EXCEPTION when balances differ by more than tolerance', () => {
    const result = svc.run(1000, 999.5, []);
    expect(result.status).toBe(ReconciliationStatus.EXCEPTION);
    expect(result.difference).toBeCloseTo(0.5, 2);
  });

  it('treats penny-level differences as TIE (within tolerance)', () => {
    const result = svc.run(1000.005, 1000.0, []);
    expect(result.status).toBe(ReconciliationStatus.TIE);
  });

  it('matches exact-amount GL and external lines', () => {
    const result = svc.run(300, 300, [
      { description: 'Inv 1', amount: 100, side: 'gl' },
      { description: 'Inv 2', amount: 200, side: 'gl' },
      { description: 'Pay 1', amount: 100, side: 'ext' },
      { description: 'Pay 2', amount: 200, side: 'ext' },
    ]);
    expect(result.matchedPairs).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
    expect(result.status).toBe(ReconciliationStatus.TIE);
  });

  it('leaves unmatched lines for human review', () => {
    const result = svc.run(300, 200, [
      { description: 'Inv 1', amount: 100, side: 'gl' },
      { description: 'Inv 2', amount: 200, side: 'gl' },
      { description: 'Pay 1', amount: 200, side: 'ext' },
    ]);
    expect(result.matchedPairs).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].amount).toBe(100);
    expect(result.status).toBe(ReconciliationStatus.EXCEPTION);
  });

  it('does not double-consume an external line for two GL lines', () => {
    // Both GL lines are $100 but there's only one $100 ext line — second
    // GL line must end up unmatched, not stolen from the first.
    const result = svc.run(200, 100, [
      { description: 'A', amount: 100, side: 'gl' },
      { description: 'B', amount: 100, side: 'gl' },
      { description: 'C', amount: 100, side: 'ext' },
    ]);
    expect(result.matchedPairs).toHaveLength(1);
    expect(result.unmatched.filter((l) => l.side === 'gl')).toHaveLength(1);
  });
});
