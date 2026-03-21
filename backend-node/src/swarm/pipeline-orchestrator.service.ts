import { Injectable, Logger } from '@nestjs/common';

export interface PipelineStep {
  id: string;
  name: string;
  dependencies: string[];
  execute: (results: Record<string, any>) => Promise<any>;
  timeoutMs: number;
  critical: boolean;
}

export interface PipelineResult {
  results: Record<string, any>;
  errors: Record<string, string>;
  completedSteps: string[];
  failedSteps: string[];
  totalMs: number;
}

@Injectable()
export class PipelineOrchestratorService {
  private readonly logger = new Logger(PipelineOrchestratorService.name);

  async execute(
    steps: PipelineStep[],
    onProgress?: (stepId: string, status: 'running' | 'done' | 'failed') => void,
  ): Promise<PipelineResult> {
    const start = Date.now();
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};
    const completed = new Set<string>();
    const failed = new Set<string>();
    const pending = new Map(steps.map(s => [s.id, s]));

    while (pending.size > 0) {
      // Find steps whose dependencies are all completed
      const ready = [...pending.values()].filter(step =>
        step.dependencies.every(dep => completed.has(dep)) &&
        !step.dependencies.some(dep => failed.has(dep) && steps.find(s => s.id === dep)?.critical)
      );

      if (ready.length === 0) {
        // Deadlock or blocked by critical failure
        for (const [id] of pending) {
          errors[id] = 'Blocked by failed dependency';
          failed.add(id);
        }
        break;
      }

      // Execute all ready steps in parallel
      await Promise.all(ready.map(async step => {
        pending.delete(step.id);
        onProgress?.(step.id, 'running');

        try {
          const result = await Promise.race([
            step.execute(results),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${step.timeoutMs}ms`)), step.timeoutMs)
            ),
          ]);
          results[step.id] = result;
          completed.add(step.id);
          onProgress?.(step.id, 'done');
        } catch (err: any) {
          errors[step.id] = err.message;
          failed.add(step.id);
          onProgress?.(step.id, 'failed');
          this.logger.warn(`Pipeline step ${step.name} failed: ${err.message}`);
        }
      }));
    }

    return {
      results,
      errors,
      completedSteps: [...completed],
      failedSteps: [...failed],
      totalMs: Date.now() - start,
    };
  }
}
