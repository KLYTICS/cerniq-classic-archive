import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// AgentCostCircuitBreakerService enforces the LLM_COST_ALERT_THRESHOLD_USD
// (Vol.2 §Environment Variables). It gates new agent runs when the
// institution's month-to-date LLM spend exceeds the configured cap.
//
// Three states:
//   OK       — spend < 80% of cap → runs proceed normally
//   WARN     — 80% ≤ spend < 100% → runs proceed, UI shows amber banner
//   BLOCKED  — spend ≥ 100% → new runs rejected with BUDGET_EXCEEDED code
//
// The threshold is configurable per-env via LLM_COST_CAP_USD_CENTS (in
// cents for integer math). When unset, the circuit breaker is open (never
// blocks) — consistent with Vol.2's default of $100.
//
// Callers: AgentQueueService.enqueue() checks before dispatching. The cost
// endpoint (AgentRunsController.cost) includes the snapshot in the
// response so the dashboard can render budget state.

export type BudgetState = 'OK' | 'WARN' | 'BLOCKED';

@Injectable()
export class AgentCostCircuitBreakerService {
  private readonly logger = new Logger(AgentCostCircuitBreakerService.name);
  private readonly capUsdCents: number | null;

  constructor(private readonly prisma: PrismaService) {
    const raw = process.env.LLM_COST_CAP_USD_CENTS;
    // Default: $100.00 = 10000 cents
    this.capUsdCents = raw ? parseInt(raw, 10) : 10000;
    if (raw && isNaN(this.capUsdCents!)) {
      this.logger.warn(
        `LLM_COST_CAP_USD_CENTS="${raw}" is not a number — circuit breaker disabled`,
      );
      this.capUsdCents = null;
    }
  }

  async isAllowed(institutionId: string): Promise<{
    allowed: boolean;
    state: BudgetState;
    spentCents: number;
    capCents: number | null;
  }> {
    if (this.capUsdCents === null) {
      return { allowed: true, state: 'OK', spentCents: 0, capCents: null };
    }

    const spentCents = await this.monthToDateSpend(institutionId);
    const state = this.classify(spentCents);

    return {
      allowed: state !== 'BLOCKED',
      state,
      spentCents,
      capCents: this.capUsdCents,
    };
  }

  snapshotForInstitution(
    institutionId: string,
    precomputedSpendCents: number,
  ): {
    capUsdCents: number | null;
    remainingUsdCents: number | null;
    state: BudgetState;
  } {
    if (this.capUsdCents === null) {
      return {
        capUsdCents: null,
        remainingUsdCents: null,
        state: 'OK',
      };
    }
    const remaining = Math.max(0, this.capUsdCents - precomputedSpendCents);
    return {
      capUsdCents: this.capUsdCents,
      remainingUsdCents: remaining,
      state: this.classify(precomputedSpendCents),
    };
  }

  // ─── internals ────────────────────────────────────────────────────────

  private async monthToDateSpend(institutionId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const result = await this.prisma.agentRun.aggregate({
      where: {
        institutionId,
        createdAt: { gte: monthStart },
      },
      _sum: { costUsdCents: true },
    });
    return result._sum.costUsdCents ?? 0;
  }

  private classify(spentCents: number): BudgetState {
    if (this.capUsdCents === null) return 'OK';
    const ratio = spentCents / this.capUsdCents;
    if (ratio >= 1) return 'BLOCKED';
    if (ratio >= 0.8) return 'WARN';
    return 'OK';
  }
}
