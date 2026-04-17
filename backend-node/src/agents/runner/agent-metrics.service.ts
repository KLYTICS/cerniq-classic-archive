import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AgentEventBusService } from './agent-event-bus.service';

// Lightweight metrics collector for the agent subsystem. Exposes counters
// and histograms matching the Vol.2 performance targets. In production
// these get scraped by Prometheus via /metrics (K2 follow-up); for now
// they accumulate in-memory and expose via getSnapshot() for the cost
// summary API and health checks.

interface HistogramBucket {
  le: number;
  count: number;
}

function makeHistogram(buckets: number[]): {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
} {
  return { buckets: buckets.map((le) => ({ le, count: 0 })), sum: 0, count: 0 };
}

function observeHistogram(
  h: ReturnType<typeof makeHistogram>,
  value: number,
): void {
  h.sum += value;
  h.count++;
  for (const b of h.buckets) if (value <= b.le) b.count++;
}

@Injectable()
export class AgentMetricsService implements OnModuleInit {
  private readonly log = new Logger(AgentMetricsService.name);

  private readonly runDuration = makeHistogram([
    1_000, 5_000, 10_000, 30_000, 45_000, 90_000, 180_000,
  ]);
  private readonly toolDuration = makeHistogram([
    100, 500, 1_000, 5_000, 10_000, 30_000, 60_000,
  ]);
  private readonly llmTokensIn = makeHistogram([
    500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000,
  ]);
  private readonly llmTokensOut = makeHistogram([
    100, 500, 1_000, 2_000, 4_000, 8_000,
  ]);

  private readonly counters = {
    runsStarted: 0,
    runsSucceeded: 0,
    runsFailed: 0,
    runsTimedOut: 0,
    toolCalls: 0,
    toolErrors: 0,
    alertsEmitted: 0,
    alertsCritical: 0,
    costUsdCents: 0,
  };

  private readonly byAgent = new Map<
    string,
    { started: number; succeeded: number; failed: number; totalMs: number }
  >();

  constructor(private readonly eventBus: AgentEventBusService) {}

  onModuleInit(): void {
    this.eventBus.onAny((event: any) => {
      switch (event?.type) {
        case 'RUN_STARTED':
          this.counters.runsStarted++;
          this.ensureAgent(event.agentId).started++;
          break;
        case 'RUN_COMPLETED': {
          this.counters.runsSucceeded++;
          const a = this.ensureAgent(event.agentId);
          a.succeeded++;
          if (event.durationMs != null) {
            observeHistogram(this.runDuration, event.durationMs);
            a.totalMs += event.durationMs;
          }
          if (event.inputTokens != null)
            observeHistogram(this.llmTokensIn, event.inputTokens);
          if (event.outputTokens != null)
            observeHistogram(this.llmTokensOut, event.outputTokens);
          if (event.costUsdCents != null)
            this.counters.costUsdCents += event.costUsdCents;
          break;
        }
        case 'RUN_FAILED':
          this.counters.runsFailed++;
          this.ensureAgent(event.agentId).failed++;
          break;
        case 'RUN_TIMED_OUT':
          this.counters.runsTimedOut++;
          break;
        case 'RUN_STEP':
          if (event.stepKind === 'TOOL_RESULT') {
            this.counters.toolCalls++;
            if (event.durationMs != null)
              observeHistogram(this.toolDuration, event.durationMs);
            if (event.ok === false) this.counters.toolErrors++;
          }
          break;
        case 'ALERT_CREATED':
          this.counters.alertsEmitted++;
          if (event.severity === 'CRITICAL') this.counters.alertsCritical++;
          break;
      }
    });
    this.log.log('agent metrics collector started');
  }

  getSnapshot(): AgentMetricsSnapshot {
    return {
      counters: { ...this.counters },
      histograms: {
        runDurationMs: histogramSnapshot(this.runDuration),
        toolDurationMs: histogramSnapshot(this.toolDuration),
        llmTokensIn: histogramSnapshot(this.llmTokensIn),
        llmTokensOut: histogramSnapshot(this.llmTokensOut),
      },
      byAgent: Object.fromEntries(this.byAgent),
      collectedAt: new Date().toISOString(),
    };
  }

  p95RunDuration(): number | null {
    return percentile(this.runDuration, 0.95);
  }

  private ensureAgent(id: string) {
    if (!this.byAgent.has(id))
      this.byAgent.set(id, { started: 0, succeeded: 0, failed: 0, totalMs: 0 });
    return this.byAgent.get(id)!;
  }
}

export interface AgentMetricsSnapshot {
  counters: {
    runsStarted: number;
    runsSucceeded: number;
    runsFailed: number;
    runsTimedOut: number;
    toolCalls: number;
    toolErrors: number;
    alertsEmitted: number;
    alertsCritical: number;
    costUsdCents: number;
  };
  histograms: {
    runDurationMs: {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      count: number;
      sum: number;
    };
    toolDurationMs: {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      count: number;
      sum: number;
    };
    llmTokensIn: {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      count: number;
      sum: number;
    };
    llmTokensOut: {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      count: number;
      sum: number;
    };
  };
  byAgent: Record<
    string,
    { started: number; succeeded: number; failed: number; totalMs: number }
  >;
  collectedAt: string;
}

function histogramSnapshot(h: ReturnType<typeof makeHistogram>) {
  return {
    p50: percentile(h, 0.5),
    p95: percentile(h, 0.95),
    p99: percentile(h, 0.99),
    count: h.count,
    sum: h.sum,
  };
}

function percentile(
  h: ReturnType<typeof makeHistogram>,
  p: number,
): number | null {
  if (h.count === 0) return null;
  const target = Math.ceil(h.count * p);
  for (const b of h.buckets) if (b.count >= target) return b.le;
  return h.buckets[h.buckets.length - 1]?.le ?? null;
}
