import { FluxNarratorService } from './flux-narrator.service';

describe('FluxNarratorService', () => {
  let svc: FluxNarratorService;
  const policy = {
    thresholdAbs: 5_000,
    thresholdPct: 0.05,
    rationaleEn: '',
    rationaleEs: '',
  };

  beforeEach(() => {
    svc = new FluxNarratorService();
  });

  it('flags large dual-trigger variances as material', () => {
    const [row] = svc.narrate(
      [
        {
          account: '5200 Salaries',
          priorBalance: 100_000,
          currentBalance: 110_000,
        },
      ],
      policy,
    );
    expect(row.varianceAbs).toBe(10_000);
    expect(row.variancePct).toBeCloseTo(0.1, 2);
    expect(row.isMaterial).toBe(true);
    expect(row.narrativeEn).toMatch(/material/i);
    expect(row.narrativeEs).toMatch(/material/i);
  });

  it('does not flag a high-percent low-dollar variance (dual-trigger)', () => {
    // 200% movement but only $200 — should NOT be material under dual-trigger
    const [row] = svc.narrate(
      [
        {
          account: '5300 Office Supplies',
          priorBalance: 100,
          currentBalance: 300,
        },
      ],
      policy,
    );
    expect(row.isMaterial).toBe(false);
    expect(row.narrativeEn).toMatch(/immaterial/i);
  });

  it('does not flag a high-dollar low-percent variance (dual-trigger)', () => {
    // $6000 of movement but only 1% — should also NOT be material
    const [row] = svc.narrate(
      [
        {
          account: '4000 Loan Income',
          priorBalance: 600_000,
          currentBalance: 606_000,
        },
      ],
      policy,
    );
    expect(row.isMaterial).toBe(false);
  });

  it('handles a brand-new account (prior balance zero) without dividing by zero', () => {
    const [row] = svc.narrate(
      [{ account: '5400 SaaS', priorBalance: 0, currentBalance: 7_500 }],
      policy,
    );
    expect(row.varianceAbs).toBe(7_500);
    expect(Number.isFinite(row.variancePct)).toBe(true);
    expect(row.isMaterial).toBe(true);
  });

  it('produces bilingual narratives for every row', () => {
    const rows = svc.narrate(
      [
        { account: 'A', priorBalance: 1, currentBalance: 1 },
        { account: 'B', priorBalance: 50, currentBalance: 60 },
      ],
      policy,
    );
    rows.forEach((r) => {
      expect(r.narrativeEn.length).toBeGreaterThan(0);
      expect(r.narrativeEs.length).toBeGreaterThan(0);
    });
  });

  it('attaches max confidence on the deterministic template', () => {
    const [row] = svc.narrate(
      [{ account: 'X', priorBalance: 100, currentBalance: 200 }],
      policy,
    );
    expect(row.confidence).toBe(1);
  });
});
