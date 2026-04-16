import { Body, Controller, Get, Param, Post, UseGuards, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AgentTrustService, type AgentTrustInput } from './agent-trust.service';
import { getOutputSchema } from './schema-registry';
import type { AgentType, AgentAuditLogReadModel, TrustVerdict } from './contracts';

const ValidateRequestSchema = z.object({
  agentType: z.string().min(1),
  runId: z.string().min(1),
  institutionId: z.string().min(1),
  agentText: z.string(),
  agentOutput: z.unknown(),
  trace: z.array(z.object({
    id: z.string(),
    runId: z.string(),
    stepNumber: z.number(),
    stepType: z.string(),
    toolName: z.string().nullable().optional(),
    toolOutput: z.unknown().nullable().optional(),
  })),
  requiredLanguage: z.enum(['en', 'es', 'bilingual']).optional(),
  maxWords: z.number().optional(),
});

/**
 * REST surface for manual trust validation. Used by:
 * - The cockpit "Validate" button (re-run trust check on a past run)
 * - CI scripts that want to validate agent output before allowing deploy
 * - Developer debugging (curl a run's output and see trust violations)
 *
 * Protected by AuthGuard in production (added at AppModule level).
 */
@Controller('api/v1/trust')
export class AgentTrustController {
  private readonly logger = new Logger(AgentTrustController.name);

  constructor(private readonly trust: AgentTrustService) {}

  @Post('validate')
  validate(@Body() body: unknown): TrustVerdict {
    const parsed = ValidateRequestSchema.parse(body);
    const schema = getOutputSchema(parsed.agentType as AgentType);

    return this.trust.evaluate({
      run: {
        id: parsed.runId,
        institutionId: parsed.institutionId,
        agentType: parsed.agentType as AgentType,
        status: 'SUCCEEDED',
        input: {},
        output: parsed.agentOutput as Record<string, unknown>,
        modelVersion: null,
      },
      agentText: parsed.agentText,
      agentOutput: parsed.agentOutput,
      trace: parsed.trace as unknown as AgentAuditLogReadModel[],
      outputSchema: schema,
      requiredLanguage: parsed.requiredLanguage,
      maxWords: parsed.maxWords,
    });
  }
}
