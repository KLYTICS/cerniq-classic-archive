import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

// In-memory circuit breaker (production: Redis-backed)
// States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)

interface CircuitState {
  state: 'closed' | 'open' | 'half_open';
  failures: number;
  lastFailure: number;
  openedAt: number;
}

const CONFIGS: Record<string, { threshold: number; cooldownMs: number }> = {
  ncua_pull: { threshold: 3, cooldownMs: 300000 }, // 5 min
  claude_api: { threshold: 5, cooldownMs: 60000 }, // 1 min
  fred_api: { threshold: 3, cooldownMs: 120000 }, // 2 min
  stripe_api: { threshold: 3, cooldownMs: 180000 }, // 3 min
  monte_carlo: { threshold: 3, cooldownMs: 30000 }, // 30 sec
  default: { threshold: 5, cooldownMs: 60000 },
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private circuits = new Map<string, CircuitState>();

  async execute<T>(
    serviceKey: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>,
  ): Promise<T> {
    const config = CONFIGS[serviceKey] ?? CONFIGS.default;
    const circuit = this.getCircuit(serviceKey);

    // Check if open
    if (circuit.state === 'open') {
      if (Date.now() - circuit.openedAt >= config.cooldownMs) {
        circuit.state = 'half_open';
        this.logger.log(
          `Circuit ${serviceKey}: open → half_open (testing recovery)`,
        );
      } else {
        if (fallback) return fallback();
        throw new ServiceUnavailableException(
          `Service ${serviceKey} circuit is open. Retry in ${Math.ceil((config.cooldownMs - (Date.now() - circuit.openedAt)) / 1000)}s`,
        );
      }
    }

    try {
      const result = await fn();
      // Success: reset
      if (circuit.state === 'half_open') {
        this.logger.log(
          `Circuit ${serviceKey}: half_open → closed (recovered)`,
        );
      }
      circuit.state = 'closed';
      circuit.failures = 0;
      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailure = Date.now();

      if (
        circuit.failures >= config.threshold ||
        circuit.state === 'half_open'
      ) {
        circuit.state = 'open';
        circuit.openedAt = Date.now();
        this.logger.error(
          `Circuit ${serviceKey} OPENED after ${circuit.failures} failures`,
        );
      }

      if (fallback) return fallback();
      throw error;
    }
  }

  getStatus(): Array<{ service: string; state: string; failures: number }> {
    return Array.from(this.circuits.entries()).map(([service, cs]) => ({
      service,
      state: cs.state,
      failures: cs.failures,
    }));
  }

  private getCircuit(key: string): CircuitState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        state: 'closed',
        failures: 0,
        lastFailure: 0,
        openedAt: 0,
      });
    }
    return this.circuits.get(key);
  }
}
