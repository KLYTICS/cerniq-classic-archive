import { Injectable, Logger } from '@nestjs/common';

/**
 * SLA Monitoring Service.
 * Tracks uptime, error rates, and latency against contractual SLA targets.
 *
 * CERNIQ Enterprise SLA:
 * - Availability: 99.9% (8.76h downtime/year)
 * - API response time: P95 < 2000ms, P99 < 5000ms
 * - Error rate: < 0.1% of requests
 * - Data freshness: Market data updated within 15 minutes
 * - Report generation: < 60 seconds for standard reports
 */

interface SLAWindow {
  totalRequests: number;
  errorRequests: number;
  latencies: number[];
  windowStart: number;
}

const SLA_TARGETS = {
  availabilityPercent: 99.9,
  p95LatencyMs: 2000,
  p99LatencyMs: 5000,
  maxErrorRatePercent: 0.1,
  reportGenerationMs: 60000,
};

const WINDOW_MS = 3600_000; // 1 hour rolling window

@Injectable()
export class SLAMonitorService {
  private readonly logger = new Logger(SLAMonitorService.name);
  private windows: SLAWindow[] = [];
  private currentWindow: SLAWindow;

  constructor() {
    this.currentWindow = this.createWindow();
  }

  recordRequest(latencyMs: number, isError: boolean) {
    this.rotateWindowIfNeeded();
    this.currentWindow.totalRequests++;
    if (isError) this.currentWindow.errorRequests++;
    this.currentWindow.latencies.push(latencyMs);

    // Keep only last 1000 latencies per window to bound memory
    if (this.currentWindow.latencies.length > 1000) {
      this.currentWindow.latencies.shift();
    }
  }

  getSLAReport(): {
    targets: typeof SLA_TARGETS;
    current: {
      windowHours: number;
      totalRequests: number;
      errorRate: number;
      errorRateMet: boolean;
      p95Ms: number;
      p95Met: boolean;
      p99Ms: number;
      p99Met: boolean;
      availabilityPercent: number;
      availabilityMet: boolean;
      overallSLAMet: boolean;
    };
    history: Array<{
      hour: string;
      requests: number;
      errorRate: number;
      p95Ms: number;
    }>;
  } {
    this.rotateWindowIfNeeded();

    // Aggregate across all windows
    const allLatencies: number[] = [];
    let totalReqs = 0;
    let totalErrors = 0;

    for (const w of [...this.windows, this.currentWindow]) {
      totalReqs += w.totalRequests;
      totalErrors += w.errorRequests;
      allLatencies.push(...w.latencies);
    }

    const sorted = [...allLatencies].sort((a: number, b: number) => a - b);
    const len = sorted.length;
    const p95 = len > 0 ? sorted[Math.floor(len * 0.95)] : 0;
    const p99 = len > 0 ? sorted[Math.floor(len * 0.99)] : 0;
    const errorRate = totalReqs > 0 ? (totalErrors / totalReqs) * 100 : 0;
    const availability = totalReqs > 0 ? ((totalReqs - totalErrors) / totalReqs) * 100 : 100;

    const errorRateMet = errorRate <= SLA_TARGETS.maxErrorRatePercent;
    const p95Met = p95 <= SLA_TARGETS.p95LatencyMs;
    const p99Met = p99 <= SLA_TARGETS.p99LatencyMs;
    const availabilityMet = availability >= SLA_TARGETS.availabilityPercent;

    // Historical hourly breakdown
    const history = this.windows.map((w: SLAWindow) => {
      const wSorted = [...w.latencies].sort((a: number, b: number) => a - b);
      const wLen = wSorted.length;
      return {
        hour: new Date(w.windowStart).toISOString(),
        requests: w.totalRequests,
        errorRate: w.totalRequests > 0 ? +((w.errorRequests / w.totalRequests) * 100).toFixed(3) : 0,
        p95Ms: wLen > 0 ? wSorted[Math.floor(wLen * 0.95)] : 0,
      };
    });

    return {
      targets: SLA_TARGETS,
      current: {
        windowHours: this.windows.length + 1,
        totalRequests: totalReqs,
        errorRate: +errorRate.toFixed(4),
        errorRateMet,
        p95Ms: p95,
        p95Met,
        p99Ms: p99,
        p99Met,
        availabilityPercent: +availability.toFixed(4),
        availabilityMet,
        overallSLAMet: errorRateMet && p95Met && p99Met && availabilityMet,
      },
      history,
    };
  }

  private rotateWindowIfNeeded() {
    const now = Date.now();
    if (now - this.currentWindow.windowStart >= WINDOW_MS) {
      this.windows.push(this.currentWindow);
      // Keep last 24 hours of windows
      if (this.windows.length > 24) this.windows.shift();
      this.currentWindow = this.createWindow();
    }
  }

  private createWindow(): SLAWindow {
    return {
      totalRequests: 0,
      errorRequests: 0,
      latencies: [],
      windowStart: Date.now(),
    };
  }
}
