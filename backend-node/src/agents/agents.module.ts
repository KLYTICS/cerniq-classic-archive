import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { AlmModule } from '../alm/alm.module';

import { AgentsController } from './agents.controller';
import { AgentAuditService } from './runner/agent-audit.service';
import { AgentRunService } from './runner/agent-run.service';
import { AgentRunnerService } from './runner/agent-runner.service';
import { AgentEventBusService } from './runner/agent-event-bus.service';
import { LlmBridgeService } from './runner/llm-bridge.service';
import { ToolRegistryService } from './registry/tool-registry.service';
import { AlmToolsFactory } from './registry/tools/alm-tools';
import { AgentTriggerService } from './trigger/agent-trigger.service';
import { QuantSwarmService } from '../swarm/quant-swarm.service';

@Module({
  imports: [PrismaModule, AlmModule],
  controllers: [AgentsController],
  providers: [
    QuantSwarmService,
    AgentEventBusService,
    AgentAuditService,
    AgentRunService,
    AgentRunnerService,
    LlmBridgeService,
    ToolRegistryService,
    AlmToolsFactory,
    AgentTriggerService,
  ],
  exports: [AgentRunnerService, AgentTriggerService, AgentEventBusService],
})
export class AgentsModule {}
