import { AlmToolsFactory } from './alm-tools';
import type { ToolContext, ToolDescriptor } from '../tool.types';

// Minimal ToolContext builder for tests — all fields required by the
// interface, but only `institutionId` is read by the handlers we exercise
// here. AbortController gives us a real (never-aborted) AbortSignal so
// downstream HTTP/DB hooks that wire to ctx.signal don't crash on access.
const makeCtx = (institutionId: string | null): ToolContext => ({
  runId: 'run-test',
  agentId: 'agent-test',
  institutionId,
  organizationId: null,
  signal: new AbortController().signal,
});

// Regression locks for two waves of alm-tools.ts `as any` fixes:
//   wave-1 (97b1c4a4 + 31a2883f): 4 phantom-method/typo fixes
//     (getIRRPolicy→getLimits, getEarlyWarning→computeEWS,
//      getDepositBeta→getDepositBetas) + runRateShock silent-arg-ignore.
//   wave-2 (this file): 2 gratuitous/phantom casts dropped — getHealthScore
//     (cast was leftover and unnecessary), getCapitalAdequacy (phantom
//     `getCapitalAdequacyRatio` → already-injected `capitalAdequacyAdapter
//     .calculate`).
// The pattern these tests defend against: a future "let me clean up this
// `as any`" attempt re-introduces the wrong method name. Without these
// locks, the dead-on-arrival TypeError class returns silently (the agent
// runtime catches and surfaces it as a TOOL_ERROR envelope; the LLM sees
// a broken tool but the test suite stays green).
//
// Construction shortcut: AlmToolsFactory has 25+ constructor params, but
// each test cares about ONE service. We pass `{} as any` for the rest
// (they're never invoked) and a focused stub for the service under test.
// This is THE legitimate `as any` use case: test ergonomics, not silent
// type evasion in production code.

describe('AlmToolsFactory phantom-method regression locks', () => {
  const findTool = (name: string, factory: AlmToolsFactory): ToolDescriptor =>
    factory.build().find((t) => t.name === name)!;

  const stubServices = (
    overrides: Record<string, unknown>,
  ): AlmToolsFactory => {
    const base: Record<string, unknown> = {
      yieldCurve: { getYieldCurveAnalysis: jest.fn().mockResolvedValue({}) },
      liquidity: { getAdvancedLiquidity: jest.fn().mockResolvedValue({}) },
      cecl: { getCECLAnalysis: jest.fn().mockResolvedValue({}) },
      concentration: {
        getConcentrationAnalysis: jest.fn().mockResolvedValue({}),
      },
      irrPolicy: { getLimits: jest.fn().mockResolvedValue([]) },
      peers: { getPeerAnalytics: jest.fn().mockResolvedValue({}) },
      repricing: { getRepricingGap: jest.fn().mockResolvedValue({}) },
      monteCarlo: { runSimulation: jest.fn().mockResolvedValue({}) },
      ews: { computeEWS: jest.fn().mockResolvedValue({}) },
      camel: { score: jest.fn().mockResolvedValue({ composite: 4 }) },
      swarm: { runFullSwarm: jest.fn() },
      advisorV2: { computeHealthScore: jest.fn().mockResolvedValue({}) },
      enterprise: {},
      ftp: { getFTPAnalysis: jest.fn().mockResolvedValue({}) },
      depositBeta: { getDepositBetas: jest.fn().mockResolvedValue([]) },
      capitalAdequacy: { calculate: jest.fn().mockResolvedValue({}) },
      complianceCalendar: {
        getUpcomingDeadlines: jest.fn().mockResolvedValue({ events: [] }),
      },
      examPrep: { getExamPrep: jest.fn().mockResolvedValue({}) },
      stressTesting: { runFullStressTest: jest.fn().mockResolvedValue({}) },
      customScenario: { runCustomScenario: jest.fn().mockResolvedValue({}) },
      depositDecay: { analyzeDecay: jest.fn().mockResolvedValue({}) },
      depositPricing: { priceDeposit: jest.fn().mockResolvedValue({}) },
      costOfFunds: { calculateCostOfFunds: jest.fn().mockResolvedValue({}) },
      depositMixOptimizer: { analyze: jest.fn().mockResolvedValue({}) },
      maturityLadder: { buildMaturityLadder: jest.fn().mockResolvedValue({}) },
      climateRisk: {},
      capitalAdequacyAdapter: { calculate: jest.fn().mockResolvedValue({}) },
    };
    const merged = { ...base, ...overrides };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (AlmToolsFactory as any)(
      ...[
        'yieldCurve',
        'liquidity',
        'cecl',
        'concentration',
        'irrPolicy',
        'peers',
        'repricing',
        'monteCarlo',
        'ews',
        'camel',
        'swarm',
        'advisorV2',
        'enterprise',
        'ftp',
        'depositBeta',
        'capitalAdequacy',
        'complianceCalendar',
        'examPrep',
        'stressTesting',
        'customScenario',
        'depositDecay',
        'depositPricing',
        'costOfFunds',
        'depositMixOptimizer',
        'maturityLadder',
        'climateRisk',
        'capitalAdequacyAdapter',
      ].map((k) => merged[k]),
    );
  };

  it('runRateShock invokes YieldCurveService.getYieldCurveAnalysis with ONLY institutionId — no silent-ignored 2nd arg', async () => {
    // Defends against re-introduction of the silent-arg-ignore bug from
    // 31a2883f. Pre-fix: `(this.yieldCurve as any).getYieldCurveAnalysis(
    // institutionId, [shocks])` — JS silently dropped the shocks array.
    // The fix dropped the cast and the dead arg. This test fails if
    // anyone re-adds the 2nd arg.
    const getYieldCurveAnalysis = jest.fn().mockResolvedValue({ shocks: [] });
    const factory = stubServices({ yieldCurve: { getYieldCurveAnalysis } });
    const tool = findTool('runRateShock', factory);
    await tool.handler({ shockBps: [100, 200, 300] }, makeCtx('inst-1'));
    expect(getYieldCurveAnalysis).toHaveBeenCalledTimes(1);
    expect(getYieldCurveAnalysis).toHaveBeenCalledWith('inst-1');
    expect(getYieldCurveAnalysis.mock.calls[0]).toHaveLength(1);
  });

  it('getIRRPolicy invokes IRRPolicyService.getLimits (not the phantom getIRRPolicy)', async () => {
    // Defends against re-introduction of phantom-method `getIRRPolicy`
    // (real method is `getLimits` returning PolicyLimitConfig[]). Pre-fix
    // the tool would have thrown TypeError at runtime the moment an LLM
    // invoked it.
    const getLimits = jest.fn().mockResolvedValue([{ limitType: 'EVE' }]);
    const factory = stubServices({ irrPolicy: { getLimits } });
    const tool = findTool('getIRRPolicy', factory);
    const result = (await tool.handler({}, makeCtx('inst-1'))) as {
      summary: string;
      data: unknown;
    };
    expect(getLimits).toHaveBeenCalledWith('inst-1');
    expect(result.summary).toMatch(/policy limits/i);
  });

  it('getEWS invokes AssetEWSService.computeEWS (not the phantom getEarlyWarning)', async () => {
    // Defends against re-introduction of phantom `getEarlyWarning`. Real
    // method is `computeEWS(institutionId): EWSResult`.
    const computeEWS = jest.fn().mockResolvedValue({ composite: 72 });
    const factory = stubServices({ ews: { computeEWS } });
    const tool = findTool('getEWS', factory);
    await tool.handler({}, makeCtx('inst-1'));
    expect(computeEWS).toHaveBeenCalledWith('inst-1');
  });

  it('getDepositBeta invokes DepositBetaService.getDepositBetas (plural — not the singular typo getDepositBeta)', async () => {
    // Defends against re-introduction of the singular-typo `getDepositBeta`.
    // Real method is `getDepositBetas` (plural, returns
    // DepositBetaConfig[]).
    const getDepositBetas = jest
      .fn()
      .mockResolvedValue([{ category: 'savings', beta: 0.3 }]);
    const factory = stubServices({ depositBeta: { getDepositBetas } });
    const tool = findTool('getDepositBeta', factory);
    await tool.handler({}, makeCtx('inst-1'));
    expect(getDepositBetas).toHaveBeenCalledWith('inst-1');
  });

  it('getHealthScore invokes AlmAdvisorV2Service.computeHealthScore cast-free (wave-2 lock)', async () => {
    // Defends the wave-2 fix: `(this.advisorV2 as any).computeHealthScore`
    // was leftover from the wave-1 audit and gratuitous — the service
    // signature `computeHealthScore(institutionId: string): Promise<HealthScore>`
    // matches exactly. If a future refactor re-introduces the cast (or
    // worse, the method signature drifts) tsc no longer catches it.
    // This runtime test does — and pins the single-arg invariant.
    const computeHealthScore = jest.fn().mockResolvedValue({ overall: 87 });
    const factory = stubServices({ advisorV2: { computeHealthScore } });
    const tool = findTool('getHealthScore', factory);
    const result = (await tool.handler({}, makeCtx('inst-1'))) as {
      summary: string;
    };
    expect(computeHealthScore).toHaveBeenCalledWith('inst-1');
    expect(computeHealthScore.mock.calls[0]).toHaveLength(1);
    expect(result.summary).toMatch(/87/);
  });

  it('getCapitalAdequacy delegates to capitalAdequacyAdapter.calculate (not the phantom getCapitalAdequacyRatio)', async () => {
    // Defends the wave-2 fix: phantom `getCapitalAdequacyRatio` on
    // CapitalAdequacyRatioService would have thrown TypeError at runtime.
    // The real path is `capitalAdequacyAdapter.calculate(institutionId)`
    // — the adapter loads the balance sheet, then delegates to the pure
    // calculator. This test fails if anyone reverts the dispatch back to
    // the pure-calculator service.
    const adapterCalculate = jest
      .fn()
      .mockResolvedValue({ netWorthRatio: 0.082 });
    const calcCalculate = jest.fn();
    const factory = stubServices({
      capitalAdequacy: { calculate: calcCalculate },
      capitalAdequacyAdapter: { calculate: adapterCalculate },
    });
    const tool = findTool('getCapitalAdequacy', factory);
    await tool.handler({}, makeCtx('inst-1'));
    expect(adapterCalculate).toHaveBeenCalledWith('inst-1');
    expect(calcCalculate).not.toHaveBeenCalled();
  });

  it('runMonteCarlo invokes MonteCarloService.runSimulation with an opts OBJECT (not a bare number) — wave-3 silent-arg-ignore lock', async () => {
    // Defends against re-introduction of the wave-3 silent-arg-ignore bug.
    // Pre-fix: `(this.monteCarlo as any).runSimulation(institutionId, input.paths)`
    // — the service signature is `runSimulation(institutionId, opts?: {paths?, ...})`,
    // so JS evaluated `(numericValue)?.paths` as undefined and the service
    // silently used its 10_000 default regardless of caller intent. The fix
    // drops the cast, passes a typed opts object, and widens the schema to
    // expose the full Vasicek surface (quarters/kappa/theta/sigma).
    const runSimulation = jest.fn().mockResolvedValue({ paths: 25_000 });
    const factory = stubServices({ monteCarlo: { runSimulation } });
    const tool = findTool('runMonteCarlo', factory);

    await tool.handler(
      { paths: 25_000, quarters: 40, kappa: 0.12, theta: 0.05, sigma: 0.02 },
      makeCtx('inst-1'),
    );

    expect(runSimulation).toHaveBeenCalledWith('inst-1', {
      paths: 25_000,
      quarters: 40,
      kappa: 0.12,
      theta: 0.05,
      sigma: 0.02,
    });
    // Critical: 2nd arg is an OBJECT, not a number. If a future regression
    // reverts to `input.paths` (bare number), this assertion fails because
    // `typeof 25_000 === 'number'` ≠ 'object'.
    expect(typeof runSimulation.mock.calls[0][1]).toBe('object');
  });

  it('runMonteCarlo omits undefined Vasicek knobs so service defaults apply (back-compat lock)', async () => {
    // Wave-3 schema widening must stay back-compat: a caller that passes
    // only `paths` still works, and the opts object surfaces the other
    // knobs as `undefined` so MonteCarloService falls through to its
    // calibrated DEFAULT_PARAMS (Fed Funds Q4 2025). If a future schema
    // change starts defaulting kappa/theta/sigma at the agent boundary,
    // the service's calibration baseline gets shadowed silently.
    const runSimulation = jest.fn().mockResolvedValue({});
    const factory = stubServices({ monteCarlo: { runSimulation } });
    const tool = findTool('runMonteCarlo', factory);

    await tool.handler({ paths: 5_000 }, makeCtx('inst-1'));

    expect(runSimulation).toHaveBeenCalledWith('inst-1', {
      paths: 5_000,
      quarters: undefined,
      kappa: undefined,
      theta: undefined,
      sigma: undefined,
    });
  });

  it('requireInstitution helper throws when ctx.institutionId is null', async () => {
    // Defense for the upstream guard the 4 tools above all rely on. Without
    // this check, a null institutionId would propagate into the service
    // call and either error obscurely or (worse) return cross-tenant data.
    const factory = stubServices({});
    const tool = findTool('runRateShock', factory);
    await expect(
      tool.handler({ shockBps: 100 }, makeCtx(null)),
    ).rejects.toThrow(/TOOL_INPUT_INVALID/);
  });
});
