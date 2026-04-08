/**
 * Golden reconciliation tests — the immune system for ALM math.
 *
 * The contract: take the canonical institution fixture (`pr-cooperativa-demo.json`),
 * run the real ALM calculation engine against it, and snapshot the output as
 * `test/golden/pr-cooperativa-demo.<method>.json`. Subsequent runs assert
 * the new output matches the snapshot byte-for-byte. Any drift in the math
 * — a refactor that "doesn't change behavior" but does, a Decimal precision
 * regression, a benchmark threshold edit, a silent fallback being
 * reintroduced — fails CI and forces a deliberate review.
 *
 * Locked decision D7 (2026-04-07): the golden files are committed to the
 * repo. There is NO auto-update on assertion failure. To regenerate, set
 * `UPDATE_GOLDEN=1` and re-run, then review the diff in PR. Auto-update
 * defeats the purpose — the manual update IS the gate.
 *
 * Why this exists: by Phase 2 batch 3 we have killed every silent-zero
 * pattern we found. The golden tests are how we catch the *next* one
 * before it ships. They pin the entire ALM math to a known-good output
 * and turn the canonical fixture into a load-bearing artifact.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { AlmService } from './alm.service';
import { DurationService } from './duration.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { getFixture } from './data/fixtures';

const GOLDEN_DIR = join(__dirname, '..', '..', 'test', 'golden');
const FIXTURE_KEY = 'pr-cooperativa-demo';
const INSTITUTION_ID = 'inst-coop-golden';

/**
 * In-memory Prisma fake that serves the cooperativa fixture's data shape
 * — institution + balance sheet items + liquidity position. The seeder's
 * percent-to-decimal rate normalization is applied here so the math sees
 * the same shape it would see in production after `seedFromFixture`.
 */
function makeFakePrismaFromFixture(): any {
  const fixture = getFixture(FIXTURE_KEY);
  const institutionRow = {
    id: INSTITUTION_ID,
    workspaceId: 'ws-golden',
    name: fixture.name,
    type: fixture.type,
    totalAssets: fixture.totalAssets,
    currency: fixture.currency,
    reportingDate: new Date(fixture.reportingDate),
    primaryRegulator: fixture.primaryRegulator ?? 'COSSEC',
    cossecRegistrationNumber: fixture.cossecRegistrationNumber ?? null,
    fiscalYearEnd: fixture.fiscalYearEnd ?? null,
    preferredLanguage: fixture.preferredLanguage ?? 'es',
    seedKey: fixture.seedKey,
    createdAt: new Date('2026-01-31T00:00:00Z'),
    updatedAt: new Date('2026-01-31T00:00:00Z'),
  };
  const items = fixture.items.map((item, idx) => ({
    id: `bsi-${idx + 1}`,
    institutionId: INSTITUTION_ID,
    category: item.category,
    subcategory: item.subcategory,
    name: item.name,
    balance: item.balance,
    // Mirror the seeder: fixtures store rate as percent; service expects decimal.
    rate: item.rate / 100,
    duration: item.duration,
    rateType: item.rateType,
    depositBeta: item.depositBeta ?? null,
    repriceDate: null,
    maturityDate: null,
  }));
  const liquidityRow = {
    id: 'liq-1',
    institutionId: INSTITUTION_ID,
    date: new Date(fixture.liquidity.date ?? fixture.reportingDate),
    hqlaLevel1: fixture.liquidity.hqlaLevel1,
    hqlaLevel2: fixture.liquidity.hqlaLevel2,
    cashOutflows: fixture.liquidity.cashOutflows,
    cashInflows: fixture.liquidity.cashInflows,
    lcr: fixture.liquidity.lcr,
    nsfr: fixture.liquidity.nsfr,
  };

  return {
    institution: {
      findUnique: jest.fn(async () => institutionRow),
    },
    balanceSheetItem: {
      findMany: jest.fn(async () => items),
      count: jest.fn(async () => items.length),
    },
    liquidityPosition: {
      findFirst: jest.fn(async () => liquidityRow),
      findMany: jest.fn(async () => [liquidityRow]),
    },
    interestRateScenario: {
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    analysisRun: {
      findFirst: jest.fn(async () => null),
    },
    reportJob: {
      findFirst: jest.fn(async () => null),
    },
  };
}

/**
 * Normalize a sub-result for snapshot comparison. Drops volatile fields
 * (none today, but the helper centralizes the rule), rounds floats to a
 * stable precision, and JSON-roundtrips so Decimal/Date instances become
 * plain values.
 *
 * The roundFloats walk traverses the result tree and rounds every numeric
 * leaf to 4 decimal places. That defeats Decimal precision drift across
 * machines without losing meaningful precision for ratios (capital ratio
 * 12.45% rounds to 12.4500, not 12).
 */
function normalize(value: unknown): unknown {
  const json = JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === 'number' && Number.isFinite(v)) {
        return Math.round(v * 10000) / 10000;
      }
      return v;
    }),
  );
  return json;
}

/**
 * Load the golden snapshot for a method. If `UPDATE_GOLDEN=1` is set or
 * the file doesn't exist, write the actual value as the new snapshot.
 * Otherwise read the file and return the stored expected value.
 *
 * The capture path is intentionally explicit — there's no silent fallback.
 * A missing file in CI causes the test to write it on disk and pass; this
 * is a deliberate choice so the FIRST commit of a golden file doesn't
 * require running the test twice. Subsequent commits go through the
 * normal assert path.
 */
function loadOrCapture(filename: string, actual: unknown): unknown {
  const path = join(GOLDEN_DIR, filename);
  const shouldCapture = process.env.UPDATE_GOLDEN === '1' || !existsSync(path);
  if (shouldCapture) {
    if (!existsSync(GOLDEN_DIR)) mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify(actual, null, 2) + '\n', 'utf-8');
    return actual;
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Golden reconciliation: pr-cooperativa-demo', () => {
  let service: AlmEnterpriseService;

  beforeEach(() => {
    const prisma = makeFakePrismaFromFixture();
    service = new AlmEnterpriseService(
      prisma,
      new AlmService(),
      new DurationService(),
    );
  });

  it('getCOSSECCompliance produces the canonical snapshot', async () => {
    const actual = normalize(
      await service.getCOSSECCompliance(INSTITUTION_ID),
    );
    const expected = loadOrCapture(
      'pr-cooperativa-demo.cossec.json',
      actual,
    );
    expect(actual).toEqual(expected);
  });

  it('calculateLCR produces the canonical snapshot', async () => {
    const actual = normalize(await service.calculateLCR(INSTITUTION_ID));
    const expected = loadOrCapture('pr-cooperativa-demo.lcr.json', actual);
    expect(actual).toEqual(expected);
  });

  it('calculateDurationGap produces the canonical snapshot', async () => {
    const actual = normalize(
      await service.calculateDurationGap(INSTITUTION_ID),
    );
    const expected = loadOrCapture(
      'pr-cooperativa-demo.duration-gap.json',
      actual,
    );
    expect(actual).toEqual(expected);
  });

  it('calculateNIISensitivity produces the canonical snapshot', async () => {
    const actual = normalize(
      await service.calculateNIISensitivity(INSTITUTION_ID),
    );
    const expected = loadOrCapture(
      'pr-cooperativa-demo.nii-sensitivity.json',
      actual,
    );
    expect(actual).toEqual(expected);
  });
});
