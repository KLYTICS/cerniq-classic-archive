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
          climate: null,
          advisor: this.advisorV2,
        } as any);
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
}
