import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

// Thin wrapper over @anthropic-ai/sdk exposing just the primitives the agent
// runner needs: tool-use turn execution with pluggable tool descriptors.
// Keeping this narrow (no streaming helpers, no memory, no routing) means
// swapping providers later touches one file.
//
// Model pinning: we pin the model ID here and version-stamp it on every
// audit row via the run-level prompt/agent version. Changing the model is
// a deliberate, auditable event, not a silent drift.

export const AGENT_LLM_MODEL = 'claude-opus-4-6';

export interface LLMToolDescriptor {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface LLMTurnRequest {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content:
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'tool_use'; id: string; name: string; input: unknown }
          | {
              type: 'tool_result';
              tool_use_id: string;
              content: string;
              is_error?: boolean;
            }
        >;
  }>;
  tools: LLMToolDescriptor[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface LLMTurnResponse {
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  text: string;
  toolCalls: LLMToolCall[];
  inputTokens: number;
  outputTokens: number;
}

@Injectable()
export class LlmBridgeService {
  private readonly logger = new Logger(LlmBridgeService.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    });
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async turn(req: LLMTurnRequest): Promise<LLMTurnResponse> {
    const response = await this.client.messages.create({
      model: AGENT_LLM_MODEL,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature ?? 0.2,
      system: req.system,
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as any,
      })),
      messages: req.messages as any,
    });

    const toolCalls: LLMToolCall[] = [];
    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    return {
      stopReason: response.stop_reason as LLMTurnResponse['stopReason'],
      text,
      toolCalls,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  }
}
