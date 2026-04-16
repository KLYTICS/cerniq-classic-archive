import { Injectable, Logger } from '@nestjs/common';
import { resolveAgentDefinition } from '../definitions/registry';
import { AgentAuditService } from './agent-audit.service';
import { AgentRunService } from './agent-run.service';
import { LlmBridgeService } from './llm-bridge.service';
import { AgentEventBusService, AGENT_EVENT } from './agent-event-bus.service';
import { ToolRegistryService } from '../registry/tool-registry.service';

type AgentRunHandle = Awaited<ReturnType<AgentRunService['startRun']>>;

export interface ExecuteOptions {
  institutionId?: string | null;
  organizationId?: string | null;
  triggeredByUserId?: string | null;
  triggerKind?: string;
  triggerRef?: string | null;
  userRoles?: string[];
  idempotencyKey: string;
}

export interface RunResult {
  runId: string;
  status: 'SUCCEEDED' | 'FAILED';
  output?: unknown;
  errorCode?: string;
  errorMessage?: string;
  existed: boolean;
  durationMs: number;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly runs: AgentRunService,
    private readonly audit: AgentAuditService,
    private readonly tools: ToolRegistryService,
    private readonly llm: LlmBridgeService,
    private readonly events: AgentEventBusService,
  ) {}

  async run(params: {
    agentId: string;
    institutionId?: string | null;
    organizationId?: string | null;
    triggeredByUserId?: string | null;
    triggerKind?: string;
    triggerRef?: string | null;
    idempotencyKey: string;
    input: unknown;
  }): Promise<RunResult> {
    return this._execute(params.agentId, params.input, {
      institutionId: params.institutionId,
      organizationId: params.organizationId,
      triggeredByUserId: params.triggeredByUserId,
      triggerKind: params.triggerKind,
      triggerRef: params.triggerRef,
      idempotencyKey: params.idempotencyKey,
    });
  }

  private async _execute(
    agentId: string,
    input: unknown,
    opts: ExecuteOptions,
  ): Promise<RunResult> {
    const start = Date.now();

    const def = resolveAgentDefinition(agentId as any);
    if (!def) {
      return { runId: '', status: 'FAILED', errorCode: 'AGENT_NOT_FOUND', errorMessage: `Agent "${agentId}" not registered`, existed: false, durationMs: Date.now() - start };
    }

    const handle: AgentRunHandle = await this.runs.startRun({
      agentId,
      agentVersion: def.agentVersion,
      promptVersion: def.promptVersion,
      institutionId: opts.institutionId,
      organizationId: opts.organizationId,
      triggeredByUserId: opts.triggeredByUserId,
      triggerKind: opts.triggerKind,
      triggerRef: opts.triggerRef,
      idempotencyKey: opts.idempotencyKey,
      input,
    });

    if (handle.replay) {
      const existing = await this.runs.getRun(handle.runId);
      return { runId: handle.runId, status: ((existing as any)?.status ?? 'SUCCEEDED') as 'SUCCEEDED' | 'FAILED', output: (existing as any)?.output ?? null, existed: true, durationMs: Date.now() - start };
    }

    await this.runs.markRunning(handle.runId);

    let lastHash: string | null = null;
    let toolCallCount = 0;
    let llmTurnCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    const appendAudit = async (args: { stepKind: string; toolName?: string | null; payload: unknown; durationMs?: number | null }) => {
      const stepIndex = handle._nextStepIndex++;
      const record = await this.audit.append(handle.runId, stepIndex, lastHash, args);
      lastHash = record.hash;
      return record;
    };

    await appendAudit({ stepKind: 'RUN_STARTED', payload: { agentId, promptVersion: def.promptVersion, triggerKind: opts.triggerKind ?? 'API' } });

    const toolDescriptors = this.tools.describeForLLM(def.allowedTools);

    const userMessage = def.buildUserMessage(input);
    const messages: any[] = [{ role: 'user', content: userMessage }];

    try {
      let finalText = '';
      while (llmTurnCount < def.maxTurns) {
        const turnStart = Date.now();
        const turn = await this.llm.turn({
          system: def.systemPrompt,
          messages,
          tools: toolDescriptors,
        });
        llmTurnCount++;
        inputTokens += turn.inputTokens;
        outputTokens += turn.outputTokens;

        await appendAudit({
          stepKind: 'LLM_TURN',
          payload: { turn: llmTurnCount, stopReason: turn.stopReason, toolCalls: turn.toolCalls.map((c) => ({ id: c.id, name: c.name })), inputTokens: turn.inputTokens, outputTokens: turn.outputTokens },
          durationMs: Date.now() - turnStart,
        });

        if (turn.stopReason !== 'tool_use') {
          finalText = turn.text;
          break;
        }

        messages.push({
          role: 'assistant',
          content: [
            ...(turn.text ? [{ type: 'text', text: turn.text }] : []),
            ...turn.toolCalls.map((c) => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input })),
          ],
        });

        const toolResults: any[] = [];
        for (const call of turn.toolCalls) {
          if (!def.allowedTools.has(call.name)) {
            toolCallCount++;
            await appendAudit({ stepKind: 'TOOL_RESULT', toolName: call.name, payload: { ok: false, code: 'TOOL_FORBIDDEN' } });
            toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify({ ok: false, code: 'TOOL_FORBIDDEN' }), is_error: true });
            continue;
          }

          await appendAudit({ stepKind: 'TOOL_CALL', toolName: call.name, payload: { input: call.input } });
          const toolStart = Date.now();
          const result = await this.tools.invoke(call.name, call.input, {
            runId: handle.runId,
            agentId: handle.agentId,
            institutionId: (opts.institutionId as string) ?? null,
            organizationId: (opts.organizationId as string) ?? null,
            signal: new AbortController().signal,
          });
          toolCallCount++;
          await appendAudit({ stepKind: 'TOOL_RESULT', toolName: call.name, payload: result, durationMs: Date.now() - toolStart });
          toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result), is_error: !result.ok });
        }
        messages.push({ role: 'user', content: toolResults });
      }

      if (llmTurnCount >= def.maxTurns && !finalText) {
        await appendAudit({ stepKind: 'RUN_FAILED', payload: { errorCode: 'LOOP_LIMIT', maxTurns: def.maxTurns } });
        await this.runs.fail(handle.runId, { errorCode: 'LOOP_LIMIT', errorMessage: `exceeded ${def.maxTurns} turns`, auditRootHash: lastHash, toolCallCount, llmTurnCount, durationMs: Date.now() - start });
        return { runId: handle.runId, status: 'FAILED', errorCode: 'LOOP_LIMIT', errorMessage: `exceeded ${def.maxTurns} turns`, existed: false, durationMs: Date.now() - start };
      }

      const parsed = parseAgentOutput(finalText, def.outputSchema);
      await appendAudit({ stepKind: 'CONTRACT_VALIDATION', payload: parsed.ok ? { ok: true } : { ok: false, error: parsed.error } });

      if (!parsed.ok) {
        await appendAudit({ stepKind: 'RUN_FAILED', payload: { errorCode: 'OUTPUT_INVALID', errorMessage: parsed.error } });
        await this.runs.fail(handle.runId, { errorCode: 'OUTPUT_CONTRACT_INVALID', errorMessage: parsed.error!, auditRootHash: lastHash, toolCallCount, llmTurnCount, durationMs: Date.now() - start });
        return { runId: handle.runId, status: 'FAILED', errorCode: 'OUTPUT_CONTRACT_INVALID', errorMessage: parsed.error!, existed: false, durationMs: Date.now() - start };
      }

      await appendAudit({ stepKind: 'RUN_COMPLETED', payload: { ok: true } });
      const durationMs = Date.now() - start;
      await this.runs.complete(handle.runId, { output: parsed.data, auditRootHash: lastHash, toolCallCount, llmTurnCount, inputTokens, outputTokens, durationMs });
      return { runId: handle.runId, status: 'SUCCEEDED', output: parsed.data, existed: false, durationMs };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`agent run ${handle.runId} crashed`, err);
      await appendAudit({ stepKind: 'RUN_FAILED', payload: { errorCode: 'EXECUTION_FAILED', errorMessage: msg } });
      await this.runs.fail(handle.runId, { errorCode: 'EXECUTION_FAILED', errorMessage: msg, auditRootHash: lastHash, toolCallCount, llmTurnCount, durationMs: Date.now() - start });
      return { runId: handle.runId, status: 'FAILED', errorCode: 'EXECUTION_FAILED', errorMessage: msg, existed: false, durationMs: Date.now() - start };
    }
  }
}

export function parseAgentOutput(text: string, schema: any): { ok: true; data: any } | { ok: false; error: string } {
  for (const c of extractJsonCandidates(text)) {
    try { const p = JSON.parse(c); const r = schema.safeParse(p); if (r.success) return { ok: true, data: r.data }; } catch {}
  }
  return { ok: false, error: `no schema-valid JSON in agent output (${text.length} chars)` };
}

function extractJsonCandidates(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const out: string[] = [];
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (f?.[1]) out.push(f[1].trim());
  out.push(t);
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) out.push(t.slice(a, b + 1));
  return out;
}

function zodToJsonSchema(schema: any): unknown {
  const def = schema?._def; const t = def?.typeName;
  if (t === 'ZodObject') {
    const s = def.shape?.() ?? {}; const p: any = {}; const r: string[] = [];
    for (const [k, v] of Object.entries(s)) { p[k] = zodToJsonSchema(v); if (!(v as any).isOptional?.()) r.push(k); }
    return { type: 'object', properties: p, required: r.length ? r : undefined, additionalProperties: false };
  }
  if (t === 'ZodString') return { type: 'string' };
  if (t === 'ZodNumber') return { type: 'number' };
  if (t === 'ZodBoolean') return { type: 'boolean' };
  if (t === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type) };
  if (t === 'ZodEnum') return { type: 'string', enum: def.values };
  if (t === 'ZodDefault') return zodToJsonSchema(def.innerType);
  if (t === 'ZodOptional') return zodToJsonSchema(def.innerType);
  return { type: 'object' };
}
