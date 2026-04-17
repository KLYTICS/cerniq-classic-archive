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
import { AgentSchedulerService } from './scheduler/agent-scheduler.service';
import { AgentAlertNotifierService } from './alert-notifier/agent-alert-notifier.service';
import { QuantSwarmService } from '../swarm/quant-swarm.service';
import { CapitalAdequacyAdapterService } from '../swarm/capital-adequacy-adapter.service';
import { EmailModule } from '../email/email.module';
import { AgentQueueModule } from '../queue/agent/agent-queue.module';
import { AgentChainService } from './runner/agent-chain.service';

@Module({
  imports: [PrismaModule, AlmModule, EmailModule, AgentQueueModule],
  controllers: [AgentsController],
  providers: [
    QuantSwarmService,
    CapitalAdequacyAdapterService,
    AgentEventBusService,
    AgentAuditService,
    AgentRunService,
    AgentRunnerService,
    LlmBridgeService,
    ToolRegistryService,
    AlmToolsFactory,
    AgentTriggerService,
    AgentSchedulerService,
    AgentAlertNotifierService,
    AgentChainService,
  ],
  exports: [
    AgentRunnerService,
    AgentTriggerService,
    AgentEventBusService,
    AgentChainService,
  ],
})
export class AgentsModule {}
