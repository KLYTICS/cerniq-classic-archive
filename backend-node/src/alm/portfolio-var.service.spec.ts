import { PortfolioVaRService } from './portfolio-var.service';

// Build a service whose Prisma returns the given asset items. `findMany` is
// `category: 'asset'`-scoped in the service, so the mock just echoes the list.
function makeService(items: any[]): PortfolioVaRService {
  const prisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue(items) },
  } as any;
  return new PortfolioVaRService(prisma);
}

// DV01 = Σ balance·duration/10000 = (100·3 + 200·5 + 50·1)/10000 = 0.135.
const REAL_ITEMS = [
  { balance: 100, duration: 3, category: 'asset' },
  { balance: 200, duration: 5, category: 'asset' },
  { balance: 50, duration: 1, category: 'asset' },
];

describe('PortfolioVaRService', () => {
  // ─── Input validation ───────────────────────────────────────
  it('rejects an invalid confidence level', async () => {
    await expect(
      makeService(REAL_ITEMS).computeVaRSuite('i', 0.9 as any, 1),
    ).rejects.toThrow('Invalid confidence level');
  });

  it('rejects an invalid horizon', async () => {
    await expect(
      makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 5 as any),
    ).rejects.toThrow('Invalid horizon');
  });

  // ─── Honest minimum: no fabricated numbers (D1) ─────────────
  it('empty balance sheet → data_unavailable shell, all VaR null, CRITICAL EMPTY_BALANCE_SHEET gap', async () => {
    const r = await makeService([]).computeVaRSuite('inst-empty', 0.95, 1);

    expect(r.status).toBe('data_unavailable');
    for (const m of [r.simulated, r.parametric, r.montecarlo]) {
      expect(m.status).toBe('data_unavailable');
      expect(m.var).toBeNull();
      expect(m.cvar).toBeNull();
      expect(m.varPct).toBeNull();
      expect(m.portfolioValue).toBeNull();
    }
    expect(r.backtestResult.status).toBe('data_unavailable');
    expect(r.backtestResult.trafficLight).toBeNull();
    expect(r.backtestResult.kupiecLR).toBeNull();

    const crit = r.gaps?.find((g) => g.severity === 'CRITICAL');
    expect(crit?.reason).toBe('EMPTY_BALANCE_SHEET');
    expect(crit?.field).toBe('var');
    // The phantom $445M demo must be gone.
    expect(JSON.stringify(r)).not.toContain('445');
  });

  it('items present but zero total value → data_unavailable with MISSING_TOTAL_ASSETS (no $0 VaR theatre)', async () => {
    const r = await makeService([
      { balance: 0, duration: 3, category: 'asset' },
    ]).computeVaRSuite('inst-zero', 0.95, 1);

    expect(r.status).toBe('data_unavailable');
    expect(r.parametric.var).toBeNull();
    expect(
      r.gaps?.some(
        (g) => g.reason === 'MISSING_TOTAL_ASSETS' && g.severity === 'CRITICAL',
      ),
    ).toBe(true);
  });

  // ─── Reproducibility (SR 11-7 model governance) ─────────────
  it('is reproducible — two calls with the same inputs are byte-identical', async () => {
    const a = await makeService(REAL_ITEMS).computeVaRSuite(
      'inst-det',
      0.99,
      10,
    );
    const b = await makeService(REAL_ITEMS).computeVaRSuite(
      'inst-det',
      0.99,
      10,
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('seeds by institution — same portfolio, different id → different synthetic draws (parametric is seed-independent)', async () => {
    const x = await makeService(REAL_ITEMS).computeVaRSuite('inst-A', 0.95, 1);
    const y = await makeService(REAL_ITEMS).computeVaRSuite('inst-B', 0.95, 1);
    // Closed-form parametric depends only on DV01 → identical.
    expect(x.parametric.var).toBe(y.parametric.var);
    // Seeded simulation depends on the institution hash → differs.
    expect(x.simulated.var).not.toBe(y.simulated.var);
  });

  // ─── The one method backed by real data ─────────────────────
  it('parametric VaR uses the real balance-sheet DV01 (closed form)', async () => {
    const r = await makeService(REAL_ITEMS).computeVaRSuite(
      'inst-dv01',
      0.95,
      1,
    );
    // VaR = z·(DV01·5bps)·√h = 1.645 · (0.135·5) · 1 = 1.11
    expect(r.parametric.var).toBeCloseTo(1.11, 2);
    expect(r.parametric.portfolioValue).toBe(350);
    expect(r.parametric.status).toBe('ok');
  });

  it('coerces Prisma Decimal balances instead of silently zeroing them', async () => {
    // Prisma returns Decimal objects, not plain numbers. Number()-coercion is
    // what makes the parametric VaR real in production.
    const dec = (n: number) => ({
      valueOf: () => n,
      toString: () => String(n),
    });
    const r = await makeService([
      { balance: dec(100), duration: dec(3), category: 'asset' },
      { balance: dec(200), duration: dec(5), category: 'asset' },
    ]).computeVaRSuite('inst-dec', 0.95, 1);

    expect(r.status).toBe('ok');
    expect(r.parametric.portfolioValue).toBe(300);
    expect(r.parametric.var!).toBeGreaterThan(0);
  });

  // ─── Honest disclosure (never label synthetic as empirical) ──
  it('discloses the synthetic basis via WARNING gaps and never claims a historical method', async () => {
    const r = await makeService(REAL_ITEMS).computeVaRSuite(
      'inst-disc',
      0.95,
      1,
    );

    expect(r.status).toBe('ok');
    expect(r.simulated.method).toBe('simulated');
    expect((r as any).historical).toBeUndefined();

    const warn = r.gaps?.filter((g) => g.severity === 'WARNING') ?? [];
    expect(warn.length).toBeGreaterThanOrEqual(1);
    expect(warn.every((g) => g.reason === 'INDICATOR_NOT_WIRED')).toBe(true);

    const simGap = r.gaps?.find((g) => g.field === 'var.simulated');
    expect(simGap?.action).toMatch(/synthetic|not empirical|self-consistency/i);
    // Disclosures are WARNING — they flag, they do not block the render.
    expect(r.gaps?.some((g) => g.severity === 'CRITICAL')).toBe(false);
  });

  // ─── Method labels + VaR invariants ─────────────────────────
  it('returns all three methods with honest labels', async () => {
    const r = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 1);
    expect(r.simulated.method).toBe('simulated');
    expect(r.parametric.method).toBe('parametric');
    expect(r.montecarlo.method).toBe('montecarlo');
  });

  it('VaR is positive and CVaR >= VaR (expected shortfall is worse)', async () => {
    const r = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 1);
    expect(r.parametric.var!).toBeGreaterThan(0);
    expect(r.parametric.cvar!).toBeGreaterThanOrEqual(r.parametric.var!);
  });

  it('99% VaR exceeds 95% VaR (parametric)', async () => {
    const r95 = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 1);
    const r99 = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.99, 1);
    expect(r99.parametric.var!).toBeGreaterThan(r95.parametric.var!);
  });

  it('10-day VaR exceeds 1-day VaR (parametric)', async () => {
    const r1 = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 1);
    const r10 = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.95, 10);
    expect(r10.parametric.var!).toBeGreaterThan(r1.parametric.var!);
  });

  // ─── Backtest (self-consistency check, disclosed as such) ───
  it('backtest returns a Basel traffic light over a 250-day window on the ok path', async () => {
    const r = await makeService(REAL_ITEMS).computeVaRSuite('i', 0.99, 1);
    expect(r.backtestResult.status).toBe('ok');
    expect(['GREEN', 'AMBER', 'RED']).toContain(r.backtestResult.trafficLight);
    expect(r.backtestResult.testDays).toBe(250);
    expect(r.backtestResult.expectedExceptions).toBeCloseTo(2.5, 0);
    expect(Number.isFinite(r.backtestResult.kupiecLR!)).toBe(true);
    expect(typeof r.backtestResult.kupiecPValue).toBe('number');
  });

  it('tolerates NaN / infinite balances (treated as 0 balance / unit duration)', async () => {
    const r = await makeService([
      { balance: NaN, duration: 3, category: 'asset' },
      { balance: 100, duration: Infinity, category: 'asset' },
    ]).computeVaRSuite('i', 0.95, 1);
    // Only the finite 100 balance contributes → portfolioValue 100, status ok.
    expect(r.status).toBe('ok');
    expect(r.parametric.portfolioValue).toBe(100);
  });
});
