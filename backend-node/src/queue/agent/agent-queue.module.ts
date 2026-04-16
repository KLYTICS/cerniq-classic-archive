import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { AgentsModule } from '../../agents/agents.module';
import { AgentQueueService } from './agent-queue.service';
import { AgentCostCircuitBreakerService } from './agent-cost-circuit-breaker.service';

// AgentQueueModule wraps the in-memory priority queue + cost circuit
// breaker for agent runs. Exports both services so AgentApiModule can
// inject them into controllers.
//
// Bull migration path: when Redis is deployed to the Railway stack,
// replace AgentQueueService with a @nestjs/bullmq processor and add the
// BullModule.forRoot configuration. The priority map, concurrency setting,
// and cost-gate logic stay the same — only the dispatch mechanism changes.
// See docs/ops/AGENT_QUEUE_RUNBOOK.md for the step-by-step.

@Module({
  imports: [PrismaModule, AgentsModule],
  providers: [AgentQueueService, AgentCostCircuitBreakerService],
  exports: [AgentQueueService, AgentCostCircuitBreakerService],
})
export class AgentQueueModule {}
