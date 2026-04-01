import { Test, TestingModule } from '@nestjs/testing';
import { PipelineHealthController } from './pipeline-health.controller';
import { DailyPipelineService } from './daily-pipeline.service';

describe('PipelineHealthController', () => {
  let controller: PipelineHealthController;

  const mockPipelineService = {
    getLastSuccessfulRun: jest.fn(),
    getTrackedTickerCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PipelineHealthController],
      providers: [
        { provide: DailyPipelineService, useValue: mockPipelineService },
      ],
    }).compile();

    controller = module.get<PipelineHealthController>(PipelineHealthController);
    jest.clearAllMocks();
  });

  it('returns operational status when last run exists', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue({
      completedAt: '2026-03-27T23:30:00Z',
      status: 'COMPLETED',
      durationMs: 45000,
      tickersProcessed: 120,
    });
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(150);

    const result = await controller.getPipelineHealth();

    expect(result.status).toBe('operational');
    expect(result.lastRunStatus).toBe('COMPLETED');
    expect(result.lastRunTickersProcessed).toBe(120);
    expect(result.tickersTracked).toBe(150);
    expect(result.nextScheduled).toBeDefined();
  });

  it('returns awaiting_first_run when no prior run exists', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();

    expect(result.status).toBe('awaiting_first_run');
    expect(result.lastSuccess).toBeNull();
    expect(result.lastRunStatus).toBe('NEVER_RUN');
  });

  it('nextScheduled is an ISO string on a weekday', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();
    const nextDate = new Date(result.nextScheduled);

    // Day 0=Sun, 6=Sat — must not be a weekend
    expect(nextDate.getDay()).not.toBe(0);
    expect(nextDate.getDay()).not.toBe(6);
    expect(result.nextScheduled).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
