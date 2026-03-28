import { IRRPolicyService } from './irr-policy.service';

describe('IRRPolicyService', () => {
  let service: IRRPolicyService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      iRRPolicyLimit: {
        findMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      balanceSheetItem: { findMany: jest.fn() },
      policyBreachLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new IRRPolicyService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns default limits when no custom limits exist', async () => {
    prisma.iRRPolicyLimit.findMany.mockResolvedValue([]);
    const limits = await service.getLimits('inst_1');

    expect(limits.length).toBeGreaterThanOrEqual(6);
    const eveLimits = limits.filter((l) => l.limitType === 'EVE_PCT');
    expect(eveLimits.length).toBe(2); // +200bps and -200bps
  });

  it('saves custom limits and returns count', async () => {
    const result = await service.saveLimits('inst_1', [
      { limitType: 'EVE_PCT', scenario: '+200bps', watchPct: 10, warningPct: 15, breachPct: 20, regulatoryRef: 'Test' },
      { limitType: 'NII_AT_RISK', scenario: '+200bps', watchPct: 8, warningPct: 12, breachPct: 16, regulatoryRef: 'Test' },
    ]);

    expect(result.saved).toBe(2);
    expect(prisma.iRRPolicyLimit.deleteMany).toHaveBeenCalledWith({ where: { institutionId: 'inst_1' } });
  });

  it('checks all limits and returns dashboard with demo metrics', async () => {
    prisma.iRRPolicyLimit.findMany.mockResolvedValue([]);
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const dashboard = await service.checkAll('inst_1');

    expect(dashboard.checks.length).toBeGreaterThanOrEqual(6);
    expect(['GREEN', 'AMBER', 'RED']).toContain(dashboard.overallStatus);
    expect(dashboard.lastChecked).toBeDefined();
    expect(dashboard.breachCount + dashboard.warningCount + dashboard.watchCount).toBeGreaterThanOrEqual(0);
  });

  it('classifies levels correctly: COMPLIANT < WATCH < WARNING < BREACH', async () => {
    prisma.iRRPolicyLimit.findMany.mockResolvedValue([]);
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const dashboard = await service.checkAll('inst_1');

    for (const check of dashboard.checks) {
      const absVal = Math.abs(check.actualValue);
      if (check.level === 'BREACH') {
        expect(absVal).toBeGreaterThanOrEqual(check.breachPct);
      } else if (check.level === 'COMPLIANT') {
        expect(absVal).toBeLessThan(check.watchPct);
      }
    }
  });

  it('returns breach history from prisma', async () => {
    prisma.policyBreachLog.findMany.mockResolvedValue([
      { limitType: 'EVE_PCT', breachLevel: 'BREACH', actualValue: 28 },
    ]);

    const history = await service.getBreachHistory('inst_1', 10);
    expect(history).toHaveLength(1);
    expect(history[0].limitType).toBe('EVE_PCT');
  });
});
