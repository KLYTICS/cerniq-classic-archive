import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { AgentToolRegistryService } from '../runner/agent-tool-registry.service';
import { AlmToolsFactory } from '../registry/tools/alm-tools';

@Injectable()
export class AgentRegistrationBootstrap implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistrationBootstrap.name);

  constructor(
    private readonly tools: AgentToolRegistryService,
    private readonly almTools: AlmToolsFactory,
  ) {}

  onModuleInit(): void {
    for (const tool of this.almTools.build()) {
      this.tools.register(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input,
          outputSchema: tool.output,
        },
        async (input: unknown, ctx) => {
          return tool.handler(input as any, {
            runId: ctx.runHandle.runId,
            agentId: ctx.runHandle.agentId,
            institutionId: ctx.institutionId ?? null,
            organizationId: ctx.organizationId ?? null,
            signal: new AbortController().signal,
          });
        },
      );
    }
    this.logger.log(`Bootstrap complete: ${this.tools.list().length} tools registered`);
  }
}
