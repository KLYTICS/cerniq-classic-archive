import { GlDataSourceService } from './gl-data-source.service';

/**
 * GlDataSourceService tests focus on the synthetic fallback path because
 * that's the one that runs in every environment — the ALM lookup needs a
 * real Prisma connection to exercise and we cover its behavior via the
 * graceful-degradation contract (ALM failure → demo data).
 */

describe('GlDataSourceService', () => {
  let svc: GlDataSourceService;
  let mockPrisma: any;

  beforeEach(() => {
    // Default: snapshot + ALM both return nothing. Tests can override.
    mockPrisma = {
      glBalanceSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    svc = new GlDataSourceService(mockPrisma);
  });

  describe('getBalance (synthetic fallback)', () => {
    it('returns source="demo" when ALM has no data', async () => {
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('demo');
      expect(result.account).toBe('1010 Operating Cash');
      expect(Number.isFinite(result.balance)).toBe(true);
    });

    it('returns deterministic balances for the same input', async () => {
      const a = await svc.getBalance('org-1', '4000 Loan Interest', 2026, 4);
      const b = await svc.getBalance('org-1', '4000 Loan Interest', 2026, 4);
      expect(a.balance).toBe(b.balance);
    });

    it('returns different balances for different periods', async () => {
      const apr = await svc.getBalance('org-1', '5200 Salaries', 2026, 4);
      const mar = await svc.getBalance('org-1', '5200 Salaries', 2026, 3);
      expect(apr.balance).not.toBe(mar.balance);
    });

    it('scales cash-class accounts into the millions', async () => {
      const cash = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      // Cash band is 250K–5M → must be at least 250K
      expect(cash.balance).toBeGreaterThanOrEqual(250_000);
    });

    it('scales small SaaS-class accounts into the low thousands', async () => {
      const saas = await svc.getBalance(
        'org-1',
        '5400 Technology / SaaS',
        2026,
        4,
      );
      // SaaS band is 5K–80K
      expect(saas.balance).toBeLessThan(100_000);
      expect(saas.balance).toBeGreaterThanOrEqual(5_000);
    });

    it('returns source="snapshot" when the snapshot table has a row', async () => {
      mockPrisma.glBalanceSnapshot.findUnique.mockResolvedValueOnce({
        balance: '1245310.22',
      });
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('snapshot');
      expect(result.balance).toBeCloseTo(1_245_310.22, 2);
      // ALM should NOT have been consulted when snapshot hit.
      expect(mockPrisma.balanceSheetItem.findMany).not.toHaveBeenCalled();
    });

    it('falls through to ALM when snapshot is empty', async () => {
      mockPrisma.glBalanceSnapshot.findUnique.mockResolvedValueOnce(null);
      mockPrisma.balanceSheetItem.findMany.mockResolvedValueOnce([
        { balance: '1234567.89' },
      ]);
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('alm');
      expect(result.balance).toBeCloseTo(1_234_567.89, 2);
    });

    it('falls through snapshot → ALM → demo when both upstream sources fail', async () => {
      mockPrisma.glBalanceSnapshot.findUnique.mockRejectedValueOnce(
        new Error('snapshot down'),
      );
      mockPrisma.balanceSheetItem.findMany.mockRejectedValueOnce(
        new Error('alm down'),
      );
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('demo');
      expect(Number.isFinite(result.balance)).toBe(true);
    });

    it('returns source="alm" when ALM finds a matching balance (legacy)', async () => {
      mockPrisma.balanceSheetItem.findMany.mockResolvedValueOnce([
        { balance: '1234567.89' },
      ]);
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('alm');
      expect(result.balance).toBeCloseTo(1_234_567.89, 2);
    });

    it('falls back to synthetic when ALM query throws', async () => {
      mockPrisma.balanceSheetItem.findMany.mockRejectedValueOnce(
        new Error('db boom'),
      );
      const result = await svc.getBalance(
        'org-1',
        '1010 Operating Cash',
        2026,
        4,
      );
      expect(result.source).toBe('demo');
      expect(Number.isFinite(result.balance)).toBe(true);
    });
  });

  describe('listAccountBalances', () => {
    it('returns the default account catalog when snapshot + ALM are empty', async () => {
      const rows = await svc.listAccountBalances('org-1', 2026, 4);
      expect(rows.length).toBeGreaterThan(10);
      expect(rows[0].source).toBe('demo');
      // Both sides must be numbers
      rows.forEach((r) => {
        expect(Number.isFinite(r.priorBalance)).toBe(true);
        expect(Number.isFinite(r.currentBalance)).toBe(true);
      });
    });

    it('uses snapshot rows when present, with prior period from snapshot too', async () => {
      // Current period rows
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([
        { account: '1010 Cash', balance: '1000' },
        { account: '4000 Income', balance: '500' },
      ]);
      // Prior period rows
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([
        { account: '1010 Cash', balance: '900' },
        { account: '4000 Income', balance: '450' },
      ]);
      const rows = await svc.listAccountBalances('org-1', 2026, 4);
      expect(rows).toHaveLength(2);
      expect(rows[0].source).toBe('snapshot');
      expect(rows[0].account).toBe('1010 Cash');
      expect(rows[0].currentBalance).toBe(1000);
      expect(rows[0].priorBalance).toBe(900);
    });

    it('falls back to synthetic prior balance when snapshot only has the current period', async () => {
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([
        { account: 'Custom Acct', balance: '1234' },
      ]);
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([]);
      const rows = await svc.listAccountBalances('org-1', 2026, 4);
      expect(rows).toHaveLength(1);
      expect(rows[0].source).toBe('snapshot');
      expect(rows[0].currentBalance).toBe(1234);
      // Prior balance synthesized — must be a finite number, not NaN
      expect(Number.isFinite(rows[0].priorBalance)).toBe(true);
    });

    it('returns ALM account names when available', async () => {
      mockPrisma.balanceSheetItem.findMany.mockResolvedValueOnce([
        { name: 'Custom ALM Account A' },
        { name: 'Custom ALM Account B' },
      ]);
      const rows = await svc.listAccountBalances('org-1', 2026, 4);
      expect(rows).toHaveLength(2);
      expect(rows[0].account).toBe('Custom ALM Account A');
      expect(rows[0].source).toBe('alm');
    });

    it('prior/current balances come from adjacent months', async () => {
      const rows = await svc.listAccountBalances('org-1', 2026, 4);
      const row = rows[0];
      // Prior and current should differ because the synthetic generator
      // uses year+month in the seed.
      expect(row.priorBalance).not.toBe(row.currentBalance);
    });

    it('handles year rollover in shiftMonth (Jan → Dec prior year)', async () => {
      const rows = await svc.listAccountBalances('org-1', 2026, 1);
      // Compare against what the direct getBalance call returns for Dec 2025
      const directPrior = await svc.getBalance(
        'org-1',
        rows[0].account,
        2025,
        12,
      );
      expect(rows[0].priorBalance).toBe(directPrior.balance);
    });
  });
});
