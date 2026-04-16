import { Body, Controller, Inject, Logger, Optional, Post } from '@nestjs/common';
import { z } from 'zod';
import type { GoldenCase, RegressionReport } from './contracts';
import type { ReplayReport } from './replay.runner';
import { GoldenRunnerService } from './golden-runner.service';
import { ReplayRunnerService } from './replay.runner';
import { getOutputSchema } from '../agent-trust/schema-registry';
import type { AgentType } from '../agent-trust/contracts';

export const GOLDEN_CASES = Symbol('GOLDEN_CASES');

const RunGoldenSchema = z.object({
  institutionId: z.string().min(1),
  only: z.array(z.string()).optional(),
  baselineAverage: z.number().optional(),
});

const ReplaySchema = z.object({
  runId: z.string().min(1),
  institutionId: z.string().min(1),
  agentType: z.string().min(1),
  narrative: z.string(),
  output: z.unknown(),
  trace: z.array(z.unknown()),
  computeMs: z.number(),
  priorVerdictPass: z.boolean().nullable().optional(),
  requiredLanguage: z.enum(['en', 'es', 'bilingual']).optional(),
  maxWords: z.number().optional(),
});

/**
 * REST surface for the eval harness and replay runner.
 *
 * - POST /eval/golden — runs golden cases against the agent runtime
 * - POST /eval/replay — replays trust validation against a stored run
 *
 * Protected by admin guard in production.
 */
@Controller('api/v1/eval')
export class AgentEvalController {
  private readonly logger = new Logger(AgentEvalController.name);

  constructor(
    private readonly goldenRunner: GoldenRunnerService,
    private readonly replayRunner: ReplayRunnerService,
    @Optional() @Inject(GOLDEN_CASES) private readonly goldenCases: readonly GoldenCase[] | null,
  ) {}

  @Post('golden')
  async runGolden(@Body() body: unknown): Promise<RegressionReport> {
    if (!this.goldenCases?.length) {
      throw new Error('No golden cases registered. Provide GOLDEN_CASES token in AppModule.');
    }
    const parsed = RunGoldenSchema.parse(body);
    return this.goldenRunner.run(parsed.institutionId, this.goldenCases, {
      only: parsed.only,
      baselineAverage: parsed.baselineAverage,
    });
  }

  @Post('replay')
  replay(@Body() body: unknown): ReplayReport {
    const parsed = ReplaySchema.parse(body);
    const schema = getOutputSchema(parsed.agentType as AgentType);

    return this.replayRunner.replay(
      {
        runId: parsed.runId,
        institutionId: parsed.institutionId,
        agentType: parsed.agentType as AgentType,
        narrative: parsed.narrative,
        output: parsed.output as Record<string, unknown>,
        trace: parsed.trace as any[],
        computeMs: parsed.computeMs,
      },
      parsed.priorVerdictPass != null
        ? {
            pass: parsed.priorVerdictPass,
            violations: [],
            summary: { block: 0, warn: 0, info: 0 },
            evaluatedInMs: 0,
          }
        : null,
      { outputSchema: schema, requiredLanguage: parsed.requiredLanguage, maxWords: parsed.maxWords },
    );
  }
}
