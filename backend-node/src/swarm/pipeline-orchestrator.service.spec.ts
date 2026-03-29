import {
  PipelineOrchestratorService,
  PipelineStep,
} from './pipeline-orchestrator.service';

describe('PipelineOrchestratorService', () => {
  let service: PipelineOrchestratorService;

  beforeEach(() => {
    service = new PipelineOrchestratorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('executes independent steps in parallel', async () => {
    const steps: PipelineStep[] = [
      {
        id: 'a',
        name: 'Step A',
        dependencies: [],
        execute: async () => 'resultA',
        timeoutMs: 5000,
        critical: false,
      },
      {
        id: 'b',
        name: 'Step B',
        dependencies: [],
        execute: async () => 'resultB',
        timeoutMs: 5000,
        critical: false,
      },
    ];
    const result = await service.execute(steps);
    expect(result.completedSteps).toContain('a');
    expect(result.completedSteps).toContain('b');
    expect(result.results.a).toBe('resultA');
    expect(result.results.b).toBe('resultB');
    expect(result.failedSteps).toHaveLength(0);
  });

  it('respects dependency ordering', async () => {
    const order: string[] = [];
    const steps: PipelineStep[] = [
      {
        id: 'first',
        name: 'First',
        dependencies: [],
        execute: async () => {
          order.push('first');
          return 1;
        },
        timeoutMs: 5000,
        critical: false,
      },
      {
        id: 'second',
        name: 'Second',
        dependencies: ['first'],
        execute: async () => {
          order.push('second');
          return 2;
        },
        timeoutMs: 5000,
        critical: false,
      },
    ];
    const result = await service.execute(steps);
    expect(order).toEqual(['first', 'second']);
    expect(result.completedSteps).toEqual(
      expect.arrayContaining(['first', 'second']),
    );
  });

  it('handles step failure gracefully', async () => {
    const steps: PipelineStep[] = [
      {
        id: 'fail',
        name: 'Failing Step',
        dependencies: [],
        execute: async () => {
          throw new Error('boom');
        },
        timeoutMs: 5000,
        critical: false,
      },
    ];
    const result = await service.execute(steps);
    expect(result.failedSteps).toContain('fail');
    expect(result.errors.fail).toBe('boom');
  });

  it('blocks downstream steps when critical step fails', async () => {
    const steps: PipelineStep[] = [
      {
        id: 'critical',
        name: 'Critical Step',
        dependencies: [],
        execute: async () => {
          throw new Error('critical failure');
        },
        timeoutMs: 5000,
        critical: true,
      },
      {
        id: 'downstream',
        name: 'Downstream',
        dependencies: ['critical'],
        execute: async () => 'should not run',
        timeoutMs: 5000,
        critical: false,
      },
    ];
    const result = await service.execute(steps);
    expect(result.failedSteps).toContain('critical');
    expect(result.failedSteps).toContain('downstream');
    expect(result.completedSteps).toHaveLength(0);
  });

  it('calls onProgress callback', async () => {
    const progress: Array<{ id: string; status: string }> = [];
    const steps: PipelineStep[] = [
      {
        id: 'step1',
        name: 'Step 1',
        dependencies: [],
        execute: async () => 'done',
        timeoutMs: 5000,
        critical: false,
      },
    ];
    await service.execute(steps, (stepId, status) => {
      progress.push({ id: stepId, status });
    });
    expect(progress).toEqual([
      { id: 'step1', status: 'running' },
      { id: 'step1', status: 'done' },
    ]);
  });
});
