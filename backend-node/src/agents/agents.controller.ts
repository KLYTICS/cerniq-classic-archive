import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AgentRunnerService } from './runner/agent-runner.service';
import { AgentRunService } from './runner/agent-run.service';
import { AgentAuditService } from './runner/agent-audit.service';
import { RunAgentRequestSchema } from './agents.dto';

@Controller('agents')
export class AgentsController {
  private readonly logger = new Logger(AgentsController.name);

  constructor(
    private readonly runner: AgentRunnerService,
    private readonly runs: AgentRunService,
    private readonly audit: AgentAuditService,
  ) {}

  @Post('run')
  async run(
    @Body() body: unknown,
    @Headers('idempotency-key') headerKey?: string,
  ) {
    const parsed = RunAgentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INPUT_INVALID',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const req = parsed.data;
    const idempotencyKey =
      headerKey?.trim() ||
      req.idempotencyKey ||
      deriveKey(req.agentId, req.triggerRef ?? 'api', req.input);

    return this.runner.run({
      agentId: req.agentId,
      institutionId: req.institutionId,
      organizationId: req.organizationId,
      triggerKind: req.triggerKind,
      triggerRef: req.triggerRef,
      idempotencyKey,
      input: req.input,
    });
  }

  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string) {
    const run = await this.runs.getById(runId);
    if (!run) throw new NotFoundException();
    return run;
  }

  @Get('runs/:runId/audit')
  async getAudit(@Param('runId') runId: string) {
    const [run, steps, chain] = await Promise.all([
      this.runs.getById(runId),
      this.audit.listForRun(runId),
      this.audit.verifyChain(runId),
    ]);
    if (!run) throw new NotFoundException();
    return { run, steps, chain };
  }
}

function deriveKey(agentId: string, scope: string, input: unknown): string {
  return createHash('sha256')
    .update(`${agentId}|${scope}|${JSON.stringify(input ?? {})}`)
    .digest('hex')
    .slice(0, 32);
}
