import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { DailyPipelineService } from './daily-pipeline.service';

describe('AdminController', () => {
  let controller: AdminController;

  const mockPipelineService = {
    runPipeline: jest.fn(),
  };

  beforeEach(async () => {
    process.env.ADMIN_KEY = 'test-admin-secret';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: DailyPipelineService, useValue: mockPipelineService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_KEY;
  });

  it('rejects requests with invalid admin key', async () => {
    await expect(controller.runPipeline('wrong-key')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('runs pipeline successfully with valid admin key', async () => {
    mockPipelineService.runPipeline.mockResolvedValue({
      tickersProcessed: 50,
      durationMs: 12000,
    });

    const result = await controller.runPipeline('test-admin-secret');

    expect(result.message).toBe('Pipeline execution completed');
    expect(result.tickersProcessed).toBe(50);
    expect(mockPipelineService.runPipeline).toHaveBeenCalledTimes(1);
  });

  it('rejects when ADMIN_KEY env var is not set', async () => {
    delete process.env.ADMIN_KEY;

    await expect(controller.runPipeline('any-key')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
