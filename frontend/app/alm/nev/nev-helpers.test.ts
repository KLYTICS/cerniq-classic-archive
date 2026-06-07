import { describe, it, expect } from 'vitest';

import {
  validateNev,
  overallBanner,
  bandTone,
  bandLabel,
  formatShockLabel,
  formatNevMillions,
  formatPct,
  formatSensitivity,
  isSupervisoryAnchor,
  supervisoryShock,
  orderedShocks,
  anchorCellClass,
  SUPERVISORY_SHOCK_BPS,
  type NevShockPoint,
} from './nev-helpers';

function shock(shockBps: number, over: Partial<NevShockPoint> = {}): NevShockPoint {
  return {
    shockBps,
    nev: 100,
    nevRatio: 7,
    nevChangePct: -5,
    riskBand: { level: 'low', label: 'Low risk', labelEs: 'Riesgo bajo' },
    ...over,
  };
}

const live = {
  institutionId: 'inst-1',
  baseNEV: 120.5,
  baseNEVRatio: 8.4,
  shocks: [shock(100), shock(300, { nevRatio: 5.1, nevChangePct: -22 })],
  worstCase: shock(300, { nevRatio: 5.1, nevChangePct: -22 }),
  overallRating: 'moderate',
};

const empty = {
  institutionId: 'inst-1',
  baseNEV: null,
  baseNEVRatio: null,
  shocks: [],
  worstCase: null,
  overallRating: 'data_unavailable',
  gaps: [
    {
      field: 'nev.balanceSheet',
      reason: 'EMPTY_BALANCE_SHEET',
      severity: 'CRITICAL',
      action: 'Cargue el balance.',
    },
  ],
};

describe('validateNev', () => {
  it('accepts a well-formed live result', () => {
    const r = validateNev(live);
    expect(r.overallRating).toBe('moderate');
    expect(r.shocks).toHaveLength(2);
  });

  it('accepts the data_unavailable shape with null base values', () => {
    const r = validateNev(empty);
    expect(r.overallRating).toBe('data_unavailable');
    expect(r.baseNEV).toBeNull();
    expect(r.baseNEVRatio).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(() => validateNev(null)).toThrow();
    expect(() => validateNev(42)).toThrow();
  });

  it('rejects missing overallRating / non-array shocks', () => {
    expect(() => validateNev({ shocks: [] })).toThrow();
    expect(() =>
      validateNev({ overallRating: 'low', shocks: {} }),
    ).toThrow();
  });

  it('rejects a non-number, non-null baseNEV / baseNEVRatio', () => {
    expect(() =>
      validateNev({ overallRating: 'low', shocks: [], baseNEV: '120' }),
    ).toThrow();
    expect(() =>
      validateNev({ overallRating: 'low', shocks: [], baseNEV: 1, baseNEVRatio: 'x' }),
    ).toThrow();
  });
});

describe('overallBanner (Spanish-first semáforo)', () => {
  it('maps each rating to ES label + tone', () => {
    expect(overallBanner('low')).toMatchObject({ es: 'RIESGO BAJO', tone: 'green' });
    expect(overallBanner('moderate')).toMatchObject({
      es: 'RIESGO MODERADO',
      tone: 'amber',
    });
    expect(overallBanner('high')).toMatchObject({ es: 'RIESGO ALTO', tone: 'red' });
    expect(overallBanner('data_unavailable')).toMatchObject({
      es: 'DATOS INSUFICIENTES',
      tone: 'gray',
    });
  });
});

describe('bandTone + bandLabel', () => {
  it('maps band level to a semáforo tone', () => {
    expect(bandTone('low')).toBe('green');
    expect(bandTone('moderate')).toBe('amber');
    expect(bandTone('high')).toBe('red');
  });

  it('labels band level bilingually', () => {
    expect(bandLabel('low', true)).toBe('Bajo');
    expect(bandLabel('low', false)).toBe('Low');
    expect(bandLabel('high', true)).toBe('Alto');
    expect(bandLabel('moderate', false)).toBe('Moderate');
  });
});

describe('formatShockLabel', () => {
  it('signs and localizes the unit', () => {
    expect(formatShockLabel(300, true)).toBe('+300 pb');
    expect(formatShockLabel(300, false)).toBe('+300 bps');
    expect(formatShockLabel(-100, true)).toBe('−100 pb');
    expect(formatShockLabel(0, false)).toBe('0 bps');
  });
});

describe('formatNevMillions (D1 — never the null sentinel)', () => {
  it('shows — for null / undefined / NaN', () => {
    expect(formatNevMillions(null)).toBe('—');
    expect(formatNevMillions(undefined)).toBe('—');
    expect(formatNevMillions(Number.NaN)).toBe('—');
  });

  it('formats positive and negative (insolvency) millions', () => {
    expect(formatNevMillions(1234.56)).toBe('$1,234.6M');
    expect(formatNevMillions(120.5)).toBe('$120.5M');
    expect(formatNevMillions(-5.04)).toBe('−$5.0M');
  });
});

describe('formatPct + formatSensitivity', () => {
  it('shows — for null and fixed-precision % otherwise', () => {
    expect(formatPct(null)).toBe('—');
    expect(formatPct(5.234)).toBe('5.23%');
    expect(formatPct(8.4, 1)).toBe('8.4%');
  });

  it('renders sensitivity as the magnitude of the NEV change', () => {
    expect(formatSensitivity(-22)).toBe('22.00%');
    expect(formatSensitivity(15.5)).toBe('15.50%');
    expect(formatSensitivity(null)).toBe('—');
  });
});

describe('supervisory anchor selection', () => {
  it('flags the +300bps row', () => {
    expect(SUPERVISORY_SHOCK_BPS).toBe(300);
    expect(isSupervisoryAnchor(300)).toBe(true);
    expect(isSupervisoryAnchor(200)).toBe(false);
    expect(isSupervisoryAnchor(-300)).toBe(false);
  });

  it('finds the +300bps shock, or null when the grid is empty', () => {
    const found = supervisoryShock(live.shocks as NevShockPoint[]);
    expect(found?.shockBps).toBe(300);
    expect(found?.nevRatio).toBe(5.1);
    expect(supervisoryShock([])).toBeNull();
  });
});

describe('orderedShocks', () => {
  it('sorts ascending without mutating the input', () => {
    const input = [shock(300), shock(-100), shock(100), shock(-300)];
    const out = orderedShocks(input);
    expect(out.map((s) => s.shockBps)).toEqual([-300, -100, 100, 300]);
    // input untouched
    expect(input.map((s) => s.shockBps)).toEqual([300, -100, 100, -300]);
  });
});

describe('anchorCellClass', () => {
  it('full-bleeds + emphasizes the anchor row, plain otherwise', () => {
    expect(anchorCellClass(true)).toContain('bg-sky-50');
    expect(anchorCellClass(true)).toContain('font-semibold');
    expect(anchorCellClass(false)).not.toContain('bg-sky-50');
    expect(anchorCellClass(false)).toBe('text-xs text-slate-700');
  });
});
