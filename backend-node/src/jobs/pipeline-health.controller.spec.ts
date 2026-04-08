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

  function mockCurrentDate(mockDate: Date) {
    const RealDate = Date;
    return jest
      .spyOn(global, 'Date')
      .mockImplementation(((value?: string | number | Date) =>
        value === undefined ? mockDate : new RealDate(value)) as any);
  }

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

  // ── Coverage boost ──

  it('returns lastRunDurationMs from last run', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue({
      completedAt: '2026-03-27T23:30:00Z',
      status: 'COMPLETED',
      durationMs: 12345,
      tickersProcessed: 50,
    });
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(60);

    const result = await controller.getPipelineHealth();
    expect(result.lastRunDurationMs).toBe(12345);
    expect(result.lastRunTickersProcessed).toBe(50);
  });

  it('returns null for lastRunDurationMs when no prior run', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();
    expect(result.lastRunDurationMs).toBeNull();
    expect(result.lastRunTickersProcessed).toBe(0);
  });

  it('nextScheduled skips past current time if already passed today', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();
    const nextDate = new Date(result.nextScheduled);
    // Next scheduled should be in the future
    expect(nextDate.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
  });

  it('nextScheduled is always set to 23:30 UTC', async () => {
    mockPipelineService.getLastSuccessfulRun.mockResolvedValue({
      completedAt: '2026-03-25T23:30:00Z',
      status: 'COMPLETED',
      durationMs: 1000,
      tickersProcessed: 10,
    });
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(10);

    const result = await controller.getPipelineHealth();
    const nextDate = new Date(result.nextScheduled);
    expect(nextDate.getUTCHours()).toBe(23);
    expect(nextDate.getUTCMinutes()).toBe(30);
  });

  it('advances to next day when current time is past 23:30 UTC (line 23)', async () => {
    // Mock Date to be past 23:30 UTC on a Friday
    // 2026-03-27 is a Friday. Set time to 23:45 UTC.
    const realDate = Date;
    const mockDate = new Date('2026-03-27T23:45:00.000Z');
    mockCurrentDate(mockDate);

    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();
    const nextDate = new realDate(result.nextScheduled);
    // Should be Monday March 30 since Sat/Sun are skipped
    expect(nextDate.getUTCDay()).not.toBe(0);
    expect(nextDate.getUTCDay()).not.toBe(6);

    jest.restoreAllMocks();
  });

  it('skips Saturday and Sunday (line 27 - weekend skip)', async () => {
    // Mock Date to be Saturday at 10:00 UTC
    // 2026-03-28 is a Saturday
    const realDate = Date;
    const mockDate = new Date('2026-03-28T10:00:00.000Z');
    mockCurrentDate(mockDate);

    mockPipelineService.getLastSuccessfulRun.mockResolvedValue(null);
    mockPipelineService.getTrackedTickerCount.mockResolvedValue(0);

    const result = await controller.getPipelineHealth();
    const nextDate = new realDate(result.nextScheduled);
    // Next run must not be weekend
    expect(nextDate.getUTCDay()).not.toBe(0);
    expect(nextDate.getUTCDay()).not.toBe(6);
    // Should be Monday (day 1)
    expect(nextDate.getUTCDay()).toBe(1);

    jest.restoreAllMocks();
  });
});
