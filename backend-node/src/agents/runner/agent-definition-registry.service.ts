import { Injectable, Logger } from '@nestjs/common';
import type { AgentDefinition } from './agent.types';

@Injectable()
export class AgentDefinitionRegistryService {
  private readonly logger = new Logger(AgentDefinitionRegistryService.name);
  private readonly defs = new Map<string, AgentDefinition>();

  register(def: AgentDefinition): void {
    if (this.defs.has(def.agentId)) {
      throw new Error(
        `AgentDefinition "${def.agentId}" is already registered.`,
      );
    }
    this.defs.set(def.agentId, def);
    this.logger.log(`Registered agent: ${def.agentId} v${def.agentVersion}`);
  }

  get(agentId: string): AgentDefinition | undefined {
    return this.defs.get(agentId);
  }

  list(): Array<{
    agentId: string;
    agentVersion: string;
    promptVersion: string;
  }> {
    return Array.from(this.defs.values()).map((d) => ({
      agentId: d.agentId,
      agentVersion: d.agentVersion,
      promptVersion: d.promptVersion,
    }));
  }

  size(): number {
    return this.defs.size;
  }
}
