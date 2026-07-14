import { LoanTapeController } from './loan-tape.controller';
import type { LoanTapeIngestService } from './loan-tape-ingest.service';
import type { LoanTapeAggregationService } from './loan-tape-aggregation.service';

describe('LoanTapeController — W2.0 HTTP surface', () => {
  let ingestSpy: jest.Mock;
  let rollupSpy: jest.Mock;
  let reconcileSpy: jest.Mock;
  let controller: LoanTapeController;

  beforeEach(() => {
    ingestSpy = jest
      .fn()
      .mockResolvedValue({ status: 'ingested', persisted: 1 });
    rollupSpy = jest.fn().mockResolvedValue({ status: 'ok', segments: [] });
    reconcileSpy = jest.fn().mockResolvedValue({ status: 'ok', rows: [] });
    controller = new LoanTapeController(
      { ingestLoanTape: ingestSpy } as unknown as LoanTapeIngestService,
      {
        rollUpToSegments: rollupSpy,
        reconcileWithSegments: reconcileSpy,
      } as unknown as LoanTapeAggregationService,
    );
  });

  it('POST loan-tape delegates to ingest service', async () => {
    await controller.ingestTape('inst-1', {
      csvContent: 'loanId,balance\nL1,1000',
      asOfDate: '2026-06-30',
    });
    expect(ingestSpy).toHaveBeenCalledWith(
      'inst-1',
      '2026-06-30',
      'loanId,balance\nL1,1000',
    );
  });

  it('GET rollup parses asOfDate', async () => {
    await controller.rollup('inst-1', '2026-06-30');
    expect(rollupSpy).toHaveBeenCalledWith(
      'inst-1',
      new Date('2026-06-30T00:00:00Z'),
    );
  });

  it('GET reconcile parses asOfDate', async () => {
    await controller.reconcile('inst-1', '2026-06-30');
    expect(reconcileSpy).toHaveBeenCalledWith(
      'inst-1',
      new Date('2026-06-30T00:00:00Z'),
    );
  });

  it('class-level guard stack is declared', () => {
    const guards = Reflect.getMetadata('__guards__', LoanTapeController);
    const names = (guards ?? []).map((g: { name: string }) => g.name);
    expect(names).toContain('AuthTenantGuard');
    expect(names).toContain('InstitutionScopeGuard');
  });
});
