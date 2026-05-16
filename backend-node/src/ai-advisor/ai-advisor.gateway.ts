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
import { JwtService } from '@nestjs/jwt';
import { isAllowedOrigin } from '../security/origin-allowlist';
import { AiAdvisorService } from './ai-advisor.service';
import { ConversationHistoryService } from './conversation-history.service';
import { InstitutionScopeGuard } from '../agent-api/guards/institution-scope.guard';
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

interface SocketUserCtx {
  userId: string;
  isMasterCeo: boolean;
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
    private readonly institutionScope: InstitutionScopeGuard,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Handshake-time auth (closes CRITICAL bypass) ────────
  //
  // Pre-fix behavior: handleConnection trusted `userId` from
  // `client.handshake.auth.userId || handshake.query.userId || 'anonymous'`
  // — zero JWT verification. Any client connecting with `?userId=anyone`
  // could emit `ask`/`history` events on behalf of anybody, billing
  // Anthropic API calls and reading any session.
  //
  // Post-fix: extract a JWT from `client.handshake.auth.token` (preferred,
  // socket.io's standard auth channel) or the legacy `Authorization:
  // Bearer <token>` header (handshake.headers.authorization). Verify via
  // the same JwtService AuthGuard uses. Reject the connection if missing
  // or invalid — fail-closed, no anonymous fallback. The verified userId
  // and master-CEO flag land on `client.data.user` for the handlers.

  async handleConnection(client: Socket): Promise<void> {
    const user = await this.verifyClientToken(client);
    if (!user) {
      this.logger.warn(
        `AI Advisor WS rejected: missing/invalid token (clientId=${client.id})`,
      );
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'Missing or invalid auth token',
      });
      client.disconnect(true);
      return;
    }
    client.data.user = user;
    this.logger.log(
      `AI Advisor WS connected: user=${user.userId} (clientId=${client.id})`,
    );
  }

  handleDisconnect(client: Socket): void {
    const userId = (client.data.user as SocketUserCtx | undefined)?.userId;
    this.logger.log(
      `AI Advisor WS disconnected: user=${userId ?? 'unauthenticated'} (clientId=${client.id})`,
    );
  }

  /**
   * Event: `ask`
   * Stream an AI-advisor response for the given institution. Body-supplied
   * `institutionId` is verified against the authenticated user via the
   * same `InstitutionScopeGuard.verifyOwnership()` primitive the HTTP path
   * uses (see e88ae20c). Single source of truth for the ownership contract.
   */
  @SubscribeMessage('ask')
  async handleAsk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: AskPayload,
  ): Promise<void> {
    const user = client.data.user as SocketUserCtx | undefined;
    if (!user) {
      // Defense-in-depth — handleConnection should have rejected, but
      // re-checking here means a future regression on the connection
      // path can't silently re-open the bypass.
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'No auth context on this socket',
      });
      return;
    }

    const parsed = AskQuestionSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit('error', {
        code: 'INPUT_INVALID',
        message: 'Invalid request',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      await this.institutionScope.verifyOwnership(
        parsed.data.institutionId,
        user.userId,
        user.isMasterCeo,
      );
    } catch (err) {
      // Fail-closed: WARN already logged inside verifyOwnership.
      client.emit('error', {
        code: 'FORBIDDEN',
        message:
          err instanceof Error ? err.message : 'Not authorized for institution',
      });
      return;
    }

    const sessionId = parsed.data.sessionId || crypto.randomUUID();
    this.logger.log(
      `AI Advisor WS ask: user=${user.userId} institution=${parsed.data.institutionId} session=${sessionId}`,
    );
    client.emit('session', { sessionId });

    try {
      const generator = this.aiAdvisor.streamAsk({
        institutionId: parsed.data.institutionId,
        userId: user.userId,
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
      this.logger.error(`AI Advisor WS error for session ${sessionId}`, error);
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
   * Event: `history`
   * Fetch session history. Same ownership contract as `ask`.
   */
  @SubscribeMessage('history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: HistoryPayload,
  ): Promise<void> {
    const user = client.data.user as SocketUserCtx | undefined;
    if (!user) {
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'No auth context on this socket',
      });
      return;
    }

    if (!payload?.institutionId || !payload?.sessionId) {
      client.emit('error', {
        code: 'INPUT_INVALID',
        message: 'institutionId and sessionId are required',
      });
      return;
    }

    try {
      await this.institutionScope.verifyOwnership(
        payload.institutionId,
        user.userId,
        user.isMasterCeo,
      );
    } catch (err) {
      client.emit('error', {
        code: 'FORBIDDEN',
        message:
          err instanceof Error ? err.message : 'Not authorized for institution',
      });
      return;
    }

    try {
      const messages = await this.conversationHistory.getSessionHistory(
        payload.institutionId,
        payload.sessionId,
        payload.limit ?? 50,
        user.userId,
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

  // ─── Token verification helpers ──────────────────────────

  private async verifyClientToken(
    client: Socket,
  ): Promise<SocketUserCtx | null> {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const payload = this.jwtService.verify(token);
      const userId =
        (payload?.userId as string | undefined) ??
        (payload?.sub as string | undefined);
      if (!userId) {
        this.logger.warn(
          `AI Advisor WS token has no userId/sub (clientId=${client.id})`,
        );
        return null;
      }
      const access = payload?.access as { isMasterCeo?: boolean } | undefined;
      return {
        userId,
        isMasterCeo: !!access?.isMasterCeo,
      };
    } catch (err) {
      this.logger.warn(
        `AI Advisor WS token verification failed: ${String(err)} (clientId=${client.id})`,
      );
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth =
      (auth?.token as string | undefined) ||
      (auth?.accessToken as string | undefined);
    if (fromAuth) return fromAuth;

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string') {
      const m = header.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    return null;
  }
}
