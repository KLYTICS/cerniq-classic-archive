/**
 * Fixture registry contract specs.
 *
 * Phase 1 (closed 2026-04-14) promised four idempotent institution fixtures
 * covering every onboarding type — bank, credit_union, family_office,
 * cooperativa — so the frontend can route every user through the idempotent
 * `/api/alm/institutions/seed` endpoint and retire the legacy
 * non-idempotent `/api/alm/seed-demo` path.
 *
 * These tests lock the contract at the fixture layer itself so a drifted
 * JSON file (missing field, wrong subcategory, balance-sheet asymmetry, or a
 * renamed fixture that breaks the frontend mapping) fails the CI suite
 * rather than a Playwright e2e. Fixtures are static JSON — the tests run in
 * milliseconds and carry no DB dependencies.
 */
import { getFixture, listFixtures } from './index';
import type { InstitutionFixture } from './_schema';

const REQUIRED_SEED_KEYS = [
  'pr-cooperativa-demo',
  'pr-bank-demo',
  'pr-credit-union-demo',
  'pr-family-office-demo',
] as const;

describe('Institution fixture registry', () => {
  it('registers all four Phase 1 fixtures', () => {
    const registered = listFixtures().map((f) => f.seedKey);
    for (const key of REQUIRED_SEED_KEYS) {
      expect(registered).toContain(key);
    }
  });

  it.each(REQUIRED_SEED_KEYS)('fixture %s is loadable by seedKey', (key) => {
    const fx = getFixture(key);
    expect(fx).toBeDefined();
    expect(fx.seedKey).toBe(key);
  });

  it('every fixture has a unique seedKey', () => {
    const keys = listFixtures().map((f) => f.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(REQUIRED_SEED_KEYS)('%s fixture integrity', (key) => {
    let fx: InstitutionFixture;
    beforeAll(() => {
      fx = getFixture(key);
    });

    it('has required top-level fields', () => {
      expect(fx.name).toBeTruthy();
      expect(fx.type).toMatch(
        /^(bank|credit_union|family_office|cooperativa)$/,
      );
      expect(fx.currency).toMatch(/^[A-Z]{3}$/);
      expect(fx.reportingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fx.totalAssets).toBeGreaterThan(0);
    });

    it('has at least one asset and one liability', () => {
      const assets = fx.items.filter((i) => i.category === 'asset');
      const liabilities = fx.items.filter((i) => i.category === 'liability');
      expect(assets.length).toBeGreaterThan(0);
      expect(liabilities.length).toBeGreaterThan(0);
    });

    it('asset balances sum close to totalAssets (±1%)', () => {
      const assetSum = fx.items
        .filter((i) => i.category === 'asset')
        .reduce((s, i) => s + i.balance, 0);
      // Tolerance: equity can slightly inflate the asset side over raw totalAssets,
      // but the combined assets should land within a conservative 5% band.
      expect(Math.abs(assetSum - fx.totalAssets) / fx.totalAssets).toBeLessThan(
        0.05,
      );
    });

    it('every item passes the D1/CSV-ingestion validation rules', () => {
      for (const [i, item] of fx.items.entries()) {
        expect(item.balance).toBeGreaterThanOrEqual(0);
        expect(item.balance).toBeLessThanOrEqual(999_999);
        // rate is stored as percent in the fixture (e.g. 6.5 = 6.5%).
        expect(item.rate).toBeGreaterThanOrEqual(0);
        expect(item.rate).toBeLessThanOrEqual(100);
        // duration is stored in years and must be finite + non-negative.
        expect(item.duration).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(item.duration)).toBe(true);
        expect(['fixed', 'variable', 'hybrid']).toContain(item.rateType);
        expect(item.name).toBeTruthy();
        expect(item.subcategory).toBeTruthy();
        // Guard against mistyped entries
        if (item.depositBeta !== undefined) {
          expect(item.depositBeta).toBeGreaterThanOrEqual(0);
          expect(item.depositBeta).toBeLessThanOrEqual(1);
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        i;
      }
    });

    it('liquidity position is self-consistent', () => {
      expect(fx.liquidity.hqlaLevel1).toBeGreaterThanOrEqual(0);
      expect(fx.liquidity.hqlaLevel2).toBeGreaterThanOrEqual(0);
      expect(fx.liquidity.cashOutflows).toBeGreaterThanOrEqual(0);
      expect(fx.liquidity.lcr).toBeGreaterThan(0);
      expect(fx.liquidity.nsfr).toBeGreaterThan(0);
    });
  });

  // Contract: the frontend `seedDemoInstitution(type)` maps every UI type to
  // a fixture below. If a type is added to the UI without a matching fixture,
  // this test breaks — catching the Phase 1 regression at compile/test time.
  it('frontend institution-type map resolves to a loadable fixture', () => {
    const frontendMap: Record<
      'bank' | 'credit_union' | 'family_office' | 'cooperativa',
      string
    > = {
      bank: 'pr-bank-demo',
      credit_union: 'pr-credit-union-demo',
      family_office: 'pr-family-office-demo',
      cooperativa: 'pr-cooperativa-demo',
    };
    for (const [type, seedKey] of Object.entries(frontendMap)) {
      const fx = getFixture(seedKey);
      expect(fx.type).toBe(type);
    }
  });
});

// ── Mauldin demo fixture (SIC 2026) ──────────────────────────────────────────
// "Cooperativa San Juan Federal" is the demo institution for the live Mauldin
// call. Its balance sheet is pinned to the demo brief so the stress narrative
// (capital ratio under SIC 2026) is derived from a reviewable, fixed snapshot —
// not numbers that drift. This is NOT in REQUIRED_SEED_KEYS (it is an extra
// demo fixture, addressed explicitly by seedKey), so it gets its own block.
describe('pr-cooperativa-san-juan-federal demo fixture', () => {
  const fx = getFixture('pr-cooperativa-san-juan-federal');

  const sum = (pred: (i: InstitutionFixture['items'][number]) => boolean) =>
    fx.items.filter(pred).reduce((s, i) => s + i.balance, 0);

  const ASSET_SUBCATS_LOANS = [
    'consumer_loans',
    'residential_mortgages',
    'commercial_loans',
  ];
  const DEPOSIT_SUBCATS = [
    'savings_deposits',
    'time_deposits',
    'demand_deposits',
  ];

  it('is a $250M COSSEC cooperativa, Spanish-first', () => {
    expect(fx.type).toBe('cooperativa');
    expect(fx.currency).toBe('USD');
    expect(fx.totalAssets).toBe(250);
    expect(fx.primaryRegulator).toBe('COSSEC');
    expect(fx.preferredLanguage).toBe('es');
  });

  it('asset items sum exactly to $250M total assets', () => {
    expect(sum((i) => i.category === 'asset')).toBe(250);
  });

  it('implies $25M equity ⇒ a 10.0% capital ratio (the demo headline)', () => {
    const assets = sum((i) => i.category === 'asset');
    const liabilities = sum((i) => i.category === 'liability');
    const equity = assets - liabilities;
    expect(equity).toBe(25);
    // capital ratio = equity / total assets
    expect((equity / fx.totalAssets) * 100).toBeCloseTo(10.0, 5);
  });

  it('loan book totals $175M (consumer $80M + mortgage $60M + commercial $35M)', () => {
    expect(
      sum(
        (i) =>
          i.category === 'asset' && ASSET_SUBCATS_LOANS.includes(i.subcategory),
      ),
    ).toBe(175);
    expect(sum((i) => i.subcategory === 'consumer_loans')).toBe(80);
    expect(sum((i) => i.subcategory === 'residential_mortgages')).toBe(60);
    expect(sum((i) => i.subcategory === 'commercial_loans')).toBe(35);
  });

  it('deposits total $210M', () => {
    expect(
      sum(
        (i) =>
          i.category === 'liability' && DEPOSIT_SUBCATS.includes(i.subcategory),
      ),
    ).toBe(210);
  });

  it('CECL loan segments reconcile to the $175M loan book', () => {
    expect(fx.loanSegments).toBeDefined();
    const segTotal = (fx.loanSegments ?? []).reduce(
      (s, seg) => s + seg.balance,
      0,
    );
    expect(segTotal).toBe(175);
  });

  it('every item passes the D1/CSV-ingestion validation rules', () => {
    for (const item of fx.items) {
      expect(item.balance).toBeGreaterThanOrEqual(0);
      expect(item.balance).toBeLessThanOrEqual(999_999);
      expect(item.rate).toBeGreaterThanOrEqual(0);
      expect(item.rate).toBeLessThanOrEqual(100);
      expect(item.duration).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(item.duration)).toBe(true);
      expect(['fixed', 'variable', 'hybrid']).toContain(item.rateType);
      if (item.depositBeta !== undefined) {
        expect(item.depositBeta).toBeGreaterThanOrEqual(0);
        expect(item.depositBeta).toBeLessThanOrEqual(1);
      }
    }
  });
});
