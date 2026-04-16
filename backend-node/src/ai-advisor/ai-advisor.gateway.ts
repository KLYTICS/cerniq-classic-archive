import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { isAllowedOrigin } from '../security/origin-allowlist';
import { AiAdvisorService } from './ai-advisor.service';
import { ConversationHistoryService } from './conversation-history.service';
import { AskQuestionSchema } from './ai-advisor.dto';
import * as crypto from 'crypto';

// ─── WebSocket payload types ────────────────────────────────

interface AskPayload {
  institutionId: string;
  question: string;
  sessionId?: string;
  language?: 'es' | 'en' | 'both';
}

interface HistoryPayload {
  institutionId: string;
  sessionId: string;
  limit?: number;
}

// ─── Gateway ────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(
        new Error(`Socket origin not allowed: ${origin || 'unknown'}`),
        false,
      );
    },
    credentials: true,
  },
  namespace: 'ai-advisor',
})
export class AiAdvisorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AiAdvisorGateway.name);

  constructor(
    private readonly aiAdvisor: AiAdvisorService,
    private readonly conversationHistory: ConversationHistoryService,
  ) {}

  handleConnection(client: Socket) {
    // Extract userId from handshake auth or query
    const userId =
      (client.handshake.auth as Record<string, string>)?.userId ||
      (client.handshake.query as Record<string, string>)?.userId ||
      'anonymous';
    (client as any)._userId = userId;

    this.logger.log(
      `AI Advisor client connected: ${client.id} (user=${userId})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`AI Advisor client disconnected: ${client.id}`);
  }

  /**
   * Event: 'ask'
   * Client sends a question, server streams back chunks via 'chunk', 'tool_use', 'done', 'error'.
   */
  @SubscribeMessage('ask')
  async handleAsk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AskPayload,
  ) {
    const parsed = AskQuestionSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit('error', {
        message: 'Invalid request',
        issues: parsed.error.issues,
      });
      return;
    }

    const userId: string = (client as any)._userId || 'anonymous';
    const sessionId = parsed.data.sessionId || crypto.randomUUID();

    this.logger.log(
      `AI Advisor WS ask: user=${userId} institution=${parsed.data.institutionId} session=${sessionId}`,
    );

    // Emit the assigned sessionId back immediately so the client can track it.
    client.emit('session', { sessionId });

    try {
      const generator = this.aiAdvisor.streamAsk({
        institutionId: parsed.data.institutionId,
        userId,
        question: parsed.data.question,
        sessionId,
        language: parsed.data.language,
      });

      for await (const chunk of generator) {
        switch (chunk.type) {
          case 'text':
            client.emit('chunk', {
              sessionId,
              content: chunk.content,
            });
            break;
          case 'tool_use':
            client.emit('tool_use', {
              sessionId,
              toolName: chunk.toolName,
            });
            break;
          case 'done':
            client.emit('done', { sessionId });
            break;
        }
      }
    } catch (error) {
      this.logger.error(
        `AI Advisor WS error for session ${sessionId}`,
        error,
      );
      client.emit('error', {
        sessionId,
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      });
    }
  }

  /**
   * Event: 'history'
   * Client requests the conversation history for a session.
   */
  @SubscribeMessage('history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HistoryPayload,
  ) {
    if (!payload?.institutionId || !payload?.sessionId) {
      client.emit('error', {
        message: 'institutionId and sessionId are required',
      });
      return;
    }

    try {
      const messages = await this.conversationHistory.getSessionHistory(
        payload.institutionId,
        payload.sessionId,
        payload.limit ?? 50,
      );

      client.emit('history', {
        sessionId: payload.sessionId,
        messages,
      });
    } catch (error) {
      this.logger.error(
        `Error fetching history for session ${payload.sessionId}`,
        error,
      );
      client.emit('error', {
        message: 'Failed to retrieve conversation history',
      });
    }
  }
}
