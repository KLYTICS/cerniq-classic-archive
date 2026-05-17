import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { DailyPipelineService } from './daily-pipeline.service';
import { AdminKeyGuard } from '../auth/admin-key.guard';

// Post-refactor: auth enforcement is now in `AdminKeyGuard` (see
// `admin-key.guard.spec.ts` for the 7-case auth-behavior suite). This
// spec covers only the controller's own behavior:
//   (a) class-level `AdminKeyGuard` is wired (reflection lock — a
//       future refactor that drops the guard fails this test loudly).
//   (b) the handler delegates to `DailyPipelineService.runPipeline()`
//       and forwards its result with the expected wrapper.
//
// Pre-refactor (`HEAD~1`) this file had 3 tests calling
// `controller.runPipeline('wrong-key')` directly — that pattern no
// longer works because guards run at HTTP layer and direct controller
// method invocation bypasses them entirely. The reflection-based
// guard-wiring lock is the structural equivalent: removing
// `@UseGuards(AdminKeyGuard)` from the controller would not change the
// behavior of `controller.runPipeline()` called directly, but WOULD
// fail this test.

describe('AdminController', () => {
  let controller: AdminController;
  const mockPipelineService = {
    runPipeline: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: DailyPipelineService, useValue: mockPipelineService },
      ],
    })
      .overrideGuard(AdminKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('has AdminKeyGuard wired at the class level (reflection lock)', () => {
    // NestJS stores @UseGuards under the '__guards__' metadata key on
    // the controller class. The lock test catches the structural
    // regression where AdminKeyGuard is removed from the decorator —
    // a behavior-only test would not detect that because direct method
    // invocation bypasses guards anyway.
    const guards = Reflect.getMetadata('__guards__', AdminController) ?? [];
    const names = guards.map((g: { name?: string }) => g?.name ?? String(g));
    expect(names).toContain('AdminKeyGuard');
  });

  it('delegates to DailyPipelineService.runPipeline and wraps the result', async () => {
    mockPipelineService.runPipeline.mockResolvedValue({
      tickersProcessed: 50,
      durationMs: 12000,
    });

    const result = await controller.runPipeline();

    expect(result.message).toBe('Pipeline execution completed');
    expect((result as any).tickersProcessed).toBe(50);
    expect(mockPipelineService.runPipeline).toHaveBeenCalledTimes(1);
  });
});
