import { Injectable, Logger } from '@nestjs/common';
import {
  AgentToolMeta,
  RegisteredTool,
  ToolDispatchContext,
  ToolHandler,
  ToolResult,
} from './agent.types';

@Injectable()
export class AgentToolRegistryService {
  private readonly logger = new Logger(AgentToolRegistryService.name);
  private readonly tools = new Map<string, RegisteredTool>();

  register(meta: AgentToolMeta, handler: ToolHandler): void {
    if (this.tools.has(meta.name)) {
      throw new Error(`AgentTool "${meta.name}" is already registered.`);
    }
    this.tools.set(meta.name, { meta, handler });
    this.logger.log(`Registered tool: ${meta.name}`);
  }

  list(): AgentToolMeta[] {
    return Array.from(this.tools.values()).map((t) => t.meta);
  }

  get(name: string): AgentToolMeta | undefined {
    return this.tools.get(name)?.meta;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async dispatch<T = unknown>(
    toolName: string,
    input: unknown,
    ctx: ToolDispatchContext,
  ): Promise<ToolResult<T>> {
    const start = Date.now();
    const registered = this.tools.get(toolName);

    if (!registered) {
      return {
        ok: false,
        code: 'TOOL_NOT_FOUND',
        message: `Tool "${toolName}" is not registered`,
        durationMs: Date.now() - start,
      };
    }

    if (registered.meta.permissions?.length) {
      const userRoles = ctx.userRoles ?? [];
      const allowed = registered.meta.permissions.some((p) =>
        userRoles.includes(p),
      );
      if (!allowed) {
        return {
          ok: false,
          code: 'TOOL_FORBIDDEN',
          message: `Caller lacks permission for tool "${toolName}"`,
          durationMs: Date.now() - start,
        };
      }
    }

    const parsedInput = registered.meta.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      return {
        ok: false,
        code: 'TOOL_INPUT_INVALID',
        message: `Input validation failed for ${toolName}: ${parsedInput.error.issues.map((i) => i.message).join('; ')}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const data = await registered.handler(parsedInput.data, ctx);

      const parsedOutput = registered.meta.outputSchema.safeParse(data);
      if (!parsedOutput.success) {
        return {
          ok: false,
          code: 'TOOL_OUTPUT_INVALID',
          message: `Output validation failed for ${toolName}`,
          durationMs: Date.now() - start,
        };
      }

      return {
        ok: true,
        data: parsedOutput.data as T,
        provenance: [registered.meta.provenanceTag ?? toolName],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      this.logger.error(`Tool ${toolName} threw`, err);
      return {
        ok: false,
        code: 'TOOL_INTERNAL_ERROR',
        message: `Tool "${toolName}" threw an unexpected error`,
        durationMs: Date.now() - start,
      };
    }
  }
}
