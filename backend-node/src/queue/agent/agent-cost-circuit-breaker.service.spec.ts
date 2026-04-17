import { AgentCostCircuitBreakerService } from './agent-cost-circuit-breaker.service';

function buildService(capCents: string | undefined = '10000') {
  const originalEnv = process.env.LLM_COST_CAP_USD_CENTS;
  process.env.LLM_COST_CAP_USD_CENTS = capCents as any;

  const prisma = {
    agentRun: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { costUsdCents: 0 } }),
    },
  };
  const svc = new AgentCostCircuitBreakerService(prisma as any);

  return {
    svc,
    prisma,
    cleanup: () => {
      if (originalEnv !== undefined) {
        process.env.LLM_COST_CAP_USD_CENTS = originalEnv;
      } else {
        delete process.env.LLM_COST_CAP_USD_CENTS;
      }
    },
  };
}

describe('AgentCostCircuitBreakerService', () => {
  it('allows when spend is under cap', async () => {
    const { svc, prisma, cleanup } = buildService('10000');
    prisma.agentRun.aggregate.mockResolvedValue({
      _sum: { costUsdCents: 5000 },
    });
    const result = await svc.isAllowed('inst_1');
    expect(result.allowed).toBe(true);
    expect(result.state).toBe('OK');
    expect(result.spentCents).toBe(5000);
    cleanup();
  });

  it('warns at 80% threshold', async () => {
    const { svc, prisma, cleanup } = buildService('10000');
    prisma.agentRun.aggregate.mockResolvedValue({
      _sum: { costUsdCents: 8500 },
    });
    const result = await svc.isAllowed('inst_1');
    expect(result.allowed).toBe(true);
    expect(result.state).toBe('WARN');
    cleanup();
  });

  it('blocks at 100% threshold', async () => {
    const { svc, prisma, cleanup } = buildService('10000');
    prisma.agentRun.aggregate.mockResolvedValue({
      _sum: { costUsdCents: 10000 },
    });
    const result = await svc.isAllowed('inst_1');
    expect(result.allowed).toBe(false);
    expect(result.state).toBe('BLOCKED');
    cleanup();
  });

  it('returns snapshot with remaining budget', () => {
    const { svc, cleanup } = buildService('10000');
    const snap = svc.snapshotForInstitution('inst_1', 7000);
    expect(snap.capUsdCents).toBe(10000);
    expect(snap.remainingUsdCents).toBe(3000);
    expect(snap.state).toBe('OK');
    cleanup();
  });

  it('remaining never goes negative', () => {
    const { svc, cleanup } = buildService('10000');
    const snap = svc.snapshotForInstitution('inst_1', 15000);
    expect(snap.remainingUsdCents).toBe(0);
    expect(snap.state).toBe('BLOCKED');
    cleanup();
  });

  it('queries only current month spend', async () => {
    const { svc, prisma, cleanup } = buildService('10000');
    await svc.isAllowed('inst_1');
    const call = prisma.agentRun.aggregate.mock.calls[0][0];
    expect(call.where.institutionId).toBe('inst_1');
    expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    const monthStart = call.where.createdAt.gte as Date;
    expect(monthStart.getUTCDate()).toBe(1);
    cleanup();
  });
});
