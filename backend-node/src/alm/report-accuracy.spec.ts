/**
 * Report accuracy lock-in — the empty-institution contract.
 *
 * Locked decision D1 (2026-04-07): when a report's inputs are incomplete,
 * the system must NEVER silently substitute zero. Numeric fields must be
 * `null`, status must be `data_unavailable`, and a top-level `gaps[]`
 * manifest must list every missing input with `severity: 'CRITICAL'`.
 *
 * This spec is the keystone — it asserts the contract end-to-end against an
 * empty institution (no balance sheet items, no liquidity position) and
 * walks through every entry point that was previously a silent-zero
 * smoking gun. If this spec ever goes red, it means the silent-zero pattern
 * has been reintroduced somewhere upstream. Read SESSION_HANDOFF.md §6
 * before "fixing" it.
 */
import { AlmEnterpriseService } from './alm-enterprise.service';
import { hasCriticalGap } from './reports/data-gap';

const emptyInstitution = {
  id: 'inst-empty',
  name: 'Test Cooperativa',
  type: 'cooperativa',
  totalAssets: 0,
  currency: 'USD',
  reportingDate: new Date('2026-01-31'),
  primaryRegulator: 'COSSEC',
  balanceSheetItems: [],
  liquidityPositions: [],
};

function makeMockPrisma() {
  const prisma: any = {
    institution: {
      findUnique: jest.fn().mockResolvedValue(emptyInstitution),
    },
    balanceSheetItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    liquidityPosition: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    interestRateScenario: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  return prisma;
}

function makeMockAlmService() {
  return {
    fullAnalysis: jest.fn().mockReturnValue({
      lcr: null, // empty BS → no derivable LCR
      summary: { totalAssets: 0, totalLiabilities: 0 },
      durationGap: { gap: 0, riskProfile: 'neutral' as const },
      niiSensitivity: { scenarios: [], baseNII: 0 },
    }),
    durationGapAnalysis: jest.fn().mockReturnValue({
      assetDuration: 0,
      liabilityDuration: 0,
      durationGap: 0,
    }),
    niiSimulation: jest.fn().mockReturnValue({
      baseNII: 0,
      scenarios: [
        { name: '+0bps', shiftBps: 0, niImpact: 0, mveImpact: 0 },
        { name: '+200bps', shiftBps: 200, niImpact: 0, mveImpact: 0 },
      ],
    }),
    eveAnalysis: jest.fn().mockReturnValue({
      baseEVE: 0,
      scenarios: [],
    }),
    calculateNIIDelta: jest.fn().mockReturnValue({
      baseNII: 0,
      scenarios: [],
    }),
  } as any;
}

function makeMockDurationService() {
  return {
    fullDurationAnalysis: jest.fn().mockReturnValue({
      portfolio: null,
      eveSensitivity: [],
    }),
  } as any;
}

describe('Report accuracy — empty institution contract (D1)', () => {
  let service: AlmEnterpriseService;
  let prisma: any;

  beforeEach(() => {
    prisma = makeMockPrisma();
    service = new AlmEnterpriseService(
      prisma,
      makeMockAlmService(),
      makeMockDurationService(),
    );
  });

  describe('calculateLCR', () => {
    it('emits a CRITICAL data_unavailable result when no liquidity row and no derivable LCR', async () => {
      const result = await service.calculateLCR('inst-empty');

      // Numeric fields are null — never silent zero.
      expect(result.lcr).toBeNull();
      expect(result.hqla).toBeNull();
      expect(result.netOutflows).toBeNull();
      expect(result.buffer).toBeNull();

      // Status communicates "no data" not "computed zero / breach".
      expect(result.status).toBe('data_unavailable');

      // Gap manifest carries the canonical statement.
      expect(result.gaps).toBeDefined();
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps![0].field).toBe('liquidity.lcr');
      expect(result.gaps![0].reason).toBe('NO_LIQUIDITY_POSITION');
      expect(result.gaps![0].severity).toBe('CRITICAL');
      expect(hasCriticalGap(result.gaps)).toBe(true);
    });
  });

  describe('getCOSSECCompliance', () => {
    it('refuses to compute the 12-ratio engine on an empty balance sheet', async () => {
      const result = await service.getCOSSECCompliance('inst-empty');

      // Empty arrays — not phantom zero ratios.
      expect(result.ratios).toEqual([]);
      expect(result.checks).toEqual([]);

      // Status communicates "no data".
      expect(result.overallStatus).toBe('data_unavailable');

      // Gap manifest is the source of truth.
      expect(result.gaps).toBeDefined();
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps![0].field).toBe('cossec.balanceSheet');
      expect(result.gaps![0].reason).toBe('EMPTY_BALANCE_SHEET');
      expect(result.gaps![0].severity).toBe('CRITICAL');

      // Summary fields are zero by necessity (the type doesn't admit null
      // here), but the data_unavailable status + gap manifest mean callers
      // know not to render these as real values.
      expect(result.summary.totalAssets).toBe(0);
      expect(result.summary.capitalRatio).toBe(0);
    });
  });

  describe('getALMSummary', () => {
    it('propagates LCR gaps into the top-level result and returns null riskScore', async () => {
      const result = await service.getALMSummary('inst-empty');

      // Liquidity sub-result carries the gap.
      expect(result.liquidity.status).toBe('data_unavailable');
      expect(result.liquidity.lcr).toBeNull();
      expect(result.liquidity.gaps).toBeDefined();
      expect(result.liquidity.gaps).toHaveLength(1);

      // Top-level gaps[] aggregates from sub-calls — the orchestrator's job.
      expect(result.gaps).toBeDefined();
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps![0].field).toBe('liquidity.lcr');
      expect(hasCriticalGap(result.gaps)).toBe(true);

      // Risk score is null — partial scores would be more misleading than
      // no score, and the gaps manifest is where the user goes for truth.
      expect(result.riskScore).toBeNull();

      // Top-risks narrative includes the LCR-data-unavailable line so a user
      // reading the report's text section sees the missing-data signal even
      // before they look at the gaps array.
      expect(result.topRisks.some((r) => /cannot be assessed/i.test(r))).toBe(
        true,
      );
    });

    it('recommends uploading liquidity data instead of an HQLA buffer recommendation', async () => {
      const result = await service.getALMSummary('inst-empty');
      expect(
        result.recommendations.some((r) => /upload.*liquidity/i.test(r)),
      ).toBe(true);
    });
  });
});
