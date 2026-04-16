import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { defineTool, type ToolDescriptor } from '../tool.types';
import { YieldCurveService } from '../../../alm/yield-curve.service';
import { LiquidityAdvancedService } from '../../../alm/liquidity-advanced.service';
import { CECLService } from '../../../alm/cecl.service';
import { ConcentrationService } from '../../../alm/concentration.service';
import { IRRPolicyService } from '../../../alm/irr-policy.service';
import { PeerAnalyticsService } from '../../../alm/peer-analytics.service';
import { RepricingGapService } from '../../../alm/repricing-gap.service';
import { MonteCarloService } from '../../../alm/monte-carlo.service';
import { AssetEWSService } from '../../../alm/asset-ews.service';
import { CAMELScorerService } from '../../../alm/exam-prep/camel-scorer.service';
import { QuantSwarmService } from '../../../swarm/quant-swarm.service';
import { AlmAdvisorV2Service } from '../../../alm/alm-advisor-v2.service';
import { AlmEnterpriseService } from '../../../alm/alm-enterprise.service';
import { FTPService } from '../../../alm/ftp.service';
import { DepositBetaService } from '../../../alm/deposit-beta.service';
import { CapitalAdequacyRatioService } from '../../../alm/capital-adequacy-ratio.service';
import { ComplianceCalendarService } from '../../../alm/compliance-calendar.service';
import { ExamPrepService } from '../../../alm/exam-prep/exam-prep.service';
import { StressTestingService } from '../../../alm/stress-testing/stress-testing.service';
import { CustomScenarioService } from '../../../alm/custom-scenario.service';
import { DepositDecayService } from '../../../alm/deposit-decay.service';
import { DepositPricingEngineService } from '../../../alm/deposit-pricing-engine.service';
import { CostOfFundsService } from '../../../alm/cost-of-funds.service';
import { UdepositUmixUoptimizerService } from '../../../alm/deposit-mix-optimizer.service';
import { MaturityLadderService } from '../../../alm/maturity-ladder.service';
import { ClimateRiskService } from '../../../alm/climate-risk.service';
import { CapitalAdequacyAdapterService } from '../../../swarm/capital-adequacy-adapter.service';

// ─── Shared tool-output shape ────────────────────────────────────────────
// Each tool returns a thin JSON envelope: a short human-readable summary
// (the LLM reads this first) plus the full structured payload. The service
// calls remain untouched; we just normalise their outputs at the tool layer.

const ToolPayload = z.object({
  summary: z.string(),
  data: z.unknown(),
});

// Narrow the ALM service calls to `any` at the tool boundary — the underlying
// services pre-date the agents module and have internal shape-flex. We rely
// on the agent contract (Zod output schema) for end-state safety, not on the
// individual service return types.

@Injectable()
export class AlmToolsFactory {
  private readonly logger = new Logger(AlmToolsFactory.name);

  constructor(
    private readonly yieldCurve: YieldCurveService,
    private readonly liquidity: LiquidityAdvancedService,
    private readonly cecl: CECLService,
    private readonly concentration: ConcentrationService,
    private readonly irrPolicy: IRRPolicyService,
    private readonly peers: PeerAnalyticsService,
    private readonly repricing: RepricingGapService,
    private readonly monteCarlo: MonteCarloService,
    private readonly ews: AssetEWSService,
    private readonly camel: CAMELScorerService,
    private readonly swarm: QuantSwarmService,
    private readonly advisorV2: AlmAdvisorV2Service,
    private readonly enterprise: AlmEnterpriseService,
    private readonly ftp: FTPService,
    private readonly depositBeta: DepositBetaService,
    private readonly capitalAdequacy: CapitalAdequacyRatioService,
    private readonly complianceCalendar: ComplianceCalendarService,
    private readonly examPrep: ExamPrepService,
    private readonly stressTesting: StressTestingService,
    private readonly customScenario: CustomScenarioService,
    private readonly depositDecay: DepositDecayService,
    private readonly depositPricing: DepositPricingEngineService,
    private readonly costOfFunds: CostOfFundsService,
    private readonly depositMixOptimizer: UdepositUmixUoptimizerService,
    private readonly maturityLadder: MaturityLadderService,
    private readonly climateRisk: ClimateRiskService,
    private readonly capitalAdequacyAdapter: CapitalAdequacyAdapterService,
  ) {}

  /// Returns the full canonical tool catalogue. The runtime calls this once
  /// per agents.module bootstrap; re-computing is cheap (no DB) so there is
  /// no caching layer — keep it simple and deterministic.
  build(): ToolDescriptor[] {
    return [
      this.runFullSwarm(),
      this.runRateShock(),
      this.getLCR(),
      this.getCECL(),
      this.getConcentration(),
      this.getIRRPolicy(),
      this.getPeerBenchmark(),
      this.getRepricingGap(),
      this.runMonteCarlo(),
      this.getEWS(),
      this.getCAMEL(),
      this.getFTP(),
      this.getDepositBeta(),
      this.getHealthScore(),
      this.getCapitalAdequacy(),
      this.getComplianceCalendar(),
      this.getExamPrep(),
      this.runStressTestSuite(),
      this.runCustomScenario(),
      this.getDepositDecay(),
      this.getDepositPricingEngine(),
      this.getCostOfFunds(),
      this.getDepositMixOptimizer(),
      this.getMaturityLadder(),
      this.getPeerAnalytics(),
    ];
  }

  private requireInstitution(ctx: { institutionId: string | null }): string {
    if (!ctx.institutionId) {
      throw new Error(
        'TOOL_INPUT_INVALID: institutionId is required for this tool',
      );
    }
    return ctx.institutionId;
  }

  // ─── Swarm-level baseline ────────────────────────────────────────────

  private runFullSwarm() {
    return defineTool({
      name: 'runFullSwarm',
      description:
        'Run the 12-model quant swarm (rate, liquidity, CECL, concentration, FTP, peers, CAMEL, climate) in parallel and return a unified SwarmContext with a composite health score. Call this first in every ALM Decision run.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 30_000,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const result = await this.swarm.runFullSwarm(institutionId, {
          yieldCurve: this.yieldCurve,
          liquidity: this.liquidity,
          cecl: this.cecl,
          concentration: this.concentration,
          ftp: this.ftp,
          peers: this.peers,
          camel: this.camel,
          climate: this.climateRisk,
          earlyWarning: this.ews,
          capitalAdequacy: this.capitalAdequacyAdapter,
          repricingGap: this.repricing,
          depositBeta: this.depositBeta,
          advisor: this.advisorV2,
        });
        return {
          summary: `Swarm complete: ${result.completedModels.length}/${
            result.completedModels.length + result.failedModels.length
          } models passed. Health ${result.healthScore}/100.`,
          data: result,
        };
      },
    });
  }

  // ─── Rate risk ───────────────────────────────────────────────────────

  private runRateShock() {
    return defineTool({
      name: 'runRateShock',
      description:
        'Compute NII and EVE impact under parallel rate shock scenarios (in basis points). Accepts a single shock or an array. Returns dollar impact, percentage of base NII, and EVE delta for each shock.',
      input: z
        .object({
          shockBps: z
            .union([
              z.number().int(),
              z.array(z.number().int()).min(1).max(10),
            ])
            .default([100, 200, 300]),
        })
        .strict(),
      output: ToolPayload,
      timeoutMs: 15_000,
      retryable: true,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.yieldCurve as any).getYieldCurveAnalysis(
          institutionId,
          Array.isArray(input.shockBps) ? input.shockBps : [input.shockBps],
        );
        return {
          summary: `Rate shock computed for ${
            Array.isArray(input.shockBps) ? input.shockBps.length : 1
          } scenario(s).`,
          data,
        };
      },
    });
  }

  // ─── Liquidity (LCR / NSFR surface) ──────────────────────────────────

  private getLCR() {
    return defineTool({
      name: 'getLCR',
      description:
        'Return the current LCR ratio, NSFR ratio, HQLA composition, and stress survival horizon.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.liquidity as any).getAdvancedLiquidity(
          institutionId,
        );
        const lcr = (data as any)?.lcr ?? null;
        return {
          summary: lcr != null ? `LCR: ${lcr}%.` : 'LCR unavailable.',
          data,
        };
      },
    });
  }

  // ─── Credit ──────────────────────────────────────────────────────────

  private getCECL() {
    return defineTool({
      name: 'getCECL',
      description:
        'Return CECL allowance by segment, coverage ratio vs peers, and vintage migration trend.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.cecl as any).getCECLAnalysis(institutionId);
        return { summary: 'CECL allowance analysis complete.', data };
      },
    });
  }

  private getConcentration() {
    return defineTool({
      name: 'getConcentration',
      description:
        'Return portfolio concentration by sector with HHI, policy limits, and any breaches.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.concentration as any).getConcentrationAnalysis(
          institutionId,
        );
        return { summary: 'Concentration analysis complete.', data };
      },
    });
  }

  // ─── Policy / governance ─────────────────────────────────────────────

  private getIRRPolicy() {
    return defineTool({
      name: 'getIRRPolicy',
      description:
        'Return the institution\'s IRR policy limits by shock scenario. Call this before flagging any rate-risk limit breach.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 5_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.irrPolicy as any).getIRRPolicy(institutionId);
        return { summary: 'IRR policy limits loaded.', data };
      },
    });
  }

  // ─── Peers ───────────────────────────────────────────────────────────

  private getPeerBenchmark() {
    return defineTool({
      name: 'getPeerBenchmark',
      description:
        'Return this institution\'s quartile position vs the COSSEC/NCUA peer cohort for a named metric (e.g. NIM, ROA, LCR, NetWorthRatio).',
      input: z
        .object({
          metric: z
            .enum([
              'NIM',
              'ROA',
              'ROE',
              'LCR',
              'NSFR',
              'NetWorthRatio',
              'EfficiencyRatio',
              'NonInterestIncomeRatio',
              'LoanToDeposit',
            ])
            .default('NIM'),
        })
        .strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.peers as any).getPeerAnalytics(
          institutionId,
          input.metric,
        );
        return {
          summary: `Peer quartile for ${input.metric} computed.`,
          data,
        };
      },
    });
  }

  // ─── Repricing / Monte Carlo ─────────────────────────────────────────

  private getRepricingGap() {
    return defineTool({
      name: 'getRepricingGap',
      description:
        'Return the repricing gap by maturity bucket (0-3m, 3-6m, 6-12m, 1-2yr, 2-5yr, 5yr+) with cumulative gap ratios.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.repricing as any).getRepricingGap(
          institutionId,
        );
        return { summary: 'Repricing gap computed.', data };
      },
    });
  }

  private runMonteCarlo() {
    return defineTool({
      name: 'runMonteCarlo',
      description:
        'Run a Monte Carlo NII simulation with N paths. Use when deterministic shocks show risk approaching policy limits and distribution tail-risk matters.',
      input: z
        .object({
          paths: z.number().int().min(100).max(100_000).default(10_000),
        })
        .strict(),
      output: ToolPayload,
      timeoutMs: 60_000,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.monteCarlo as any).runSimulation(
          institutionId,
          input.paths,
        );
        return {
          summary: `Monte Carlo simulation complete (${input.paths} paths).`,
          data,
        };
      },
    });
  }

  // ─── EWS / CAMEL ─────────────────────────────────────────────────────

  private getEWS() {
    return defineTool({
      name: 'getEWS',
      description:
        'Return the Early Warning System composite and sub-scores (capital, liquidity, earnings, asset-quality).',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.ews as any).getEarlyWarning(institutionId);
        return { summary: 'EWS composite computed.', data };
      },
    });
  }

  private getCAMEL() {
    return defineTool({
      name: 'getCAMEL',
      description:
        'Return the CAMEL composite and component scores (Capital, Asset quality, Management, Earnings, Liquidity) plus exam-readiness rating.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 15_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await this.camel.scoreInstitution(institutionId);
        return {
          summary: `CAMEL composite: ${(data as any)?.composite ?? 'n/a'}.`,
          data,
        };
      },
    });
  }

  // ─── FTP / Deposit ───────────────────────────────────────────────────

  private getFTP() {
    return defineTool({
      name: 'getFTP',
      description:
        'Return the Funds Transfer Pricing curve and matched-maturity funding cost for a given product term.',
      input: z
        .object({
          termMonths: z.number().int().min(1).max(360).optional(),
        })
        .strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.ftp as any).getFTPAnalysis(
          institutionId,
          input.termMonths,
        );
        return { summary: 'FTP curve computed.', data };
      },
    });
  }

  private getDepositBeta() {
    return defineTool({
      name: 'getDepositBeta',
      description:
        'Return deposit betas by product (checking, savings, CDs) vs peer benchmarks.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.depositBeta as any).getDepositBeta(
          institutionId,
        );
        return { summary: 'Deposit betas computed.', data };
      },
    });
  }

  // ─── Health score (copilot convenience) ──────────────────────────────

  private getHealthScore() {
    return defineTool({
      name: 'getHealthScore',
      description:
        'Return the 0-100 composite health score plus its dimension break-down. Cheap to call — safe for any agent.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 5_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.advisorV2 as any).computeHealthScore(
          institutionId,
        );
        return {
          summary: `Health Score: ${(data as any)?.overall ?? 'n/a'}/100.`,
          data,
        };
      },
    });
  }

  // ─── Capital adequacy ───────────────────────────────────────────────

  private getCapitalAdequacy() {
    return defineTool({
      name: 'getCapitalAdequacy',
      description:
        'Return the net worth ratio, risk-based capital ratio, and COSSEC/NCUA capital minimums with buffer analysis.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.capitalAdequacy as any).getCapitalAdequacyRatio(institutionId);
        return { summary: 'Capital adequacy computed.', data };
      },
    });
  }

  // ─── Compliance ─────────────────────────────────────────────────────

  private getComplianceCalendar() {
    return defineTool({
      name: 'getComplianceCalendar',
      description:
        'Return upcoming regulatory deadlines (COSSEC, NCUA, OCIF, FinCEN, CFPB) with urgency classification and preparation status.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.complianceCalendar as any).getUpcomingDeadlines(institutionId);
        return {
          summary: `Compliance calendar: ${(data as any)?.events?.length ?? 0} deadlines loaded.`,
          data,
        };
      },
    });
  }

  // ─── Exam preparation ───────────────────────────────────────────────

  private getExamPrep() {
    return defineTool({
      name: 'getExamPrep',
      description:
        'Return the 24-item governance checklist, CAMEL self-assessment, documentation readiness, and exam findings with remediation items.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 15_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.examPrep as any).getExamPrep(institutionId);
        const gov = (data as any)?.governance;
        return {
          summary: gov
            ? `Governance: ${gov.completedCount}/${gov.totalCount} items. Management score: ${gov.managementScore}.`
            : 'Exam prep data loaded.',
          data,
        };
      },
    });
  }

  // ─── Stress testing ─────────────────────────────────────────────────

  private runStressTestSuite() {
    return defineTool({
      name: 'runStressTestSuite',
      description:
        'Run the full stress test suite: Monte Carlo + regulatory scenarios + COSSEC named scenarios (parallel_up, hurricane, liquidity crisis). Returns pass/warn/fail per scenario.',
      input: z.object({
        paths: z.number().int().min(100).max(10_000).default(1_000),
      }).strict(),
      output: ToolPayload,
      timeoutMs: 60_000,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.stressTesting as any).runFullStressTest(institutionId, { paths: input.paths });
        const scenarios = (data as any)?.cossecScenarios?.length ?? 0;
        return { summary: `Stress suite complete: ${scenarios} scenarios evaluated.`, data };
      },
    });
  }

  private runCustomScenario() {
    return defineTool({
      name: 'runCustomScenario',
      description:
        'Run a user-defined stress scenario with custom rate shift, deposit runoff, credit shock, and prepayment multiplier. Returns NII/EVE/LCR/capital impact.',
      input: z.object({
        name: z.string().min(1),
        rateShiftBps: z.number().int().min(-300).max(300),
        yieldCurveTwist: z.number().int().optional(),
        depositRunoff: z.number().min(0).max(30).optional(),
        loanDefaultIncrease: z.number().min(0).max(15).optional(),
        prepaymentMultiplier: z.number().min(0.5).max(3).optional(),
      }).strict(),
      output: ToolPayload,
      timeoutMs: 30_000,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.customScenario as any).runCustomScenario(institutionId, input);
        return { summary: `Custom scenario "${input.name}" computed.`, data };
      },
    });
  }

  // ─── Deposit analytics ──────────────────────────────────────────────

  private getDepositDecay() {
    return defineTool({
      name: 'getDepositDecay',
      description:
        'Return deposit decay rates (NMD runoff) by product: exponential λ, half-life, behavioral maturity, survival curves. Critical for EVE and NSFR ASF factors.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.depositDecay as any).analyzeDecay(institutionId);
        return { summary: 'Deposit decay analysis complete.', data };
      },
    });
  }

  private getDepositPricingEngine() {
    return defineTool({
      name: 'getDepositPricingEngine',
      description:
        'Return optimal deposit rate recommendations using logistic retention model: current vs competitor rates, retention probability, and revenue-maximizing rate.',
      input: z.object({
        product: z.string().optional(),
      }).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.depositPricing as any).priceDeposit({ institutionId, product: input.product });
        return { summary: 'Deposit pricing analysis complete.', data };
      },
    });
  }

  private getCostOfFunds() {
    return defineTool({
      name: 'getCostOfFunds',
      description:
        'Return the weighted average cost of funds decomposed by product type: total, marginal, and per-category breakdowns.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.costOfFunds as any).calculateCostOfFunds({ institutionId });
        return { summary: 'Cost of funds computed.', data };
      },
    });
  }

  private getDepositMixOptimizer() {
    return defineTool({
      name: 'getDepositMixOptimizer',
      description:
        'Run the deposit mix optimization model: target product mix (%), expected cost reduction (bps), and implementation timeline.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 15_000,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.depositMixOptimizer as any).analyze({ institutionId });
        return { summary: 'Deposit mix optimization complete.', data };
      },
    });
  }

  private getMaturityLadder() {
    return defineTool({
      name: 'getMaturityLadder',
      description:
        'Return the maturity ladder by bucket (O/N through >10yr): asset/liability totals, gap, cumulative gap, and concentration risk. Flags any bucket with >15% of CDs maturing.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 10_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.maturityLadder as any).buildMaturityLadder({ institutionId });
        return {
          summary: `Maturity ladder: ${(data as any)?.buckets?.length ?? 0} buckets.`,
          data,
        };
      },
    });
  }

  // ─── Full peer analytics (for Peer Intelligence Agent) ──────────────

  private getPeerAnalytics() {
    return defineTool({
      name: 'getPeerAnalytics',
      description:
        'Return full peer analytics: quartile rankings for all metrics, trend vs prior quarter, competitive gaps with dollar impact, and market intelligence.',
      input: z.object({}).strict(),
      output: ToolPayload,
      timeoutMs: 15_000,
      retryable: true,
      handler: async (_input, ctx) => {
        const institutionId = this.requireInstitution(ctx);
        const data = await (this.peers as any).getPeerAnalytics(institutionId);
        return { summary: 'Full peer analytics computed.', data };
      },
    });
  }
}
