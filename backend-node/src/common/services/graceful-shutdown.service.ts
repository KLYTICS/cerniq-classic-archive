import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common';

/**
 * Graceful shutdown service that drains in-flight work before exit.
 * Register active tasks with track() and call complete() when done.
 * On shutdown, waits up to DRAIN_TIMEOUT_MS for all tasks to finish.
 */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly DRAIN_TIMEOUT_MS = 10_000;
  private activeTasks = 0;
  private drainResolve: (() => void) | null = null;

  /** Call when starting an async task (queue job, long request, etc.) */
  track(): void {
    this.activeTasks++;
  }

  /** Call when a tracked task completes */
  complete(): void {
    this.activeTasks = Math.max(0, this.activeTasks - 1);
    if (this.activeTasks === 0 && this.drainResolve) {
      this.drainResolve();
    }
  }

  get pending(): number {
    return this.activeTasks;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutdown signal received: ${signal ?? 'unknown'}`);
    this.logger.log(`Draining ${this.activeTasks} active task(s)...`);

    if (this.activeTasks === 0) {
      this.logger.log('No active tasks — shutting down immediately');
      return;
    }

    let drainTimeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          this.drainResolve = resolve;
        }),
        new Promise<void>((resolve) => {
          drainTimeout = setTimeout(() => {
            this.logger.warn(
              `Drain timeout (${this.DRAIN_TIMEOUT_MS}ms) reached with ${this.activeTasks} task(s) remaining`,
            );
            resolve();
          }, this.DRAIN_TIMEOUT_MS);
          if (drainTimeout.unref) {
            drainTimeout.unref();
          }
        }),
      ]);
    } finally {
      this.drainResolve = null;
      if (drainTimeout) {
        clearTimeout(drainTimeout);
      }
    }

    this.logger.log('Shutdown drain complete');
  }
}
