import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Logger,
  UseGuards,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { InstitutionScopeGuard } from '../agent-api/guards/institution-scope.guard';
import { AiAdvisorService } from './ai-advisor.service';
import { ConversationHistoryService } from './conversation-history.service';
import {
  AskQuestionSchema,
  SessionParamsSchema,
  SessionHistoryParamsSchema,
  DeleteSessionParamsSchema,
} from './ai-advisor.dto';
import * as crypto from 'crypto';

@ApiTags('AI Advisor')
@ApiBearerAuth()
@Controller('api/ai-advisor')
@UseGuards(AuthGuard, InstitutionScopeGuard)
export class AiAdvisorController {
  private readonly logger = new Logger(AiAdvisorController.name);

  constructor(
    private readonly aiAdvisor: AiAdvisorService,
    private readonly conversationHistory: ConversationHistoryService,
  ) {}

  /**
   * POST /api/ai-advisor/ask
   * Ask a question and receive a full (non-streaming) response.
   */
  @Post('ask')
  @HttpCode(200)
  async ask(@Body() body: unknown, @Req() req: any) {
    const parsed = AskQuestionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { institutionId, question, language } = parsed.data;
    const sessionId = parsed.data.sessionId || crypto.randomUUID();
    const userId: string = req.user?.id ?? req.user?.sub ?? 'anonymous';

    this.logger.log(
      `AI Advisor ask: institution=${institutionId} session=${sessionId} q="${question.slice(0, 80)}..."`,
    );

    const response = await this.aiAdvisor.ask({
      institutionId,
      userId,
      question,
      sessionId,
      language,
    });

    return response;
  }

  /**
   * GET /api/ai-advisor/sessions/:institutionId
   * List all chat sessions for the current user at an institution.
   */
  @Get('sessions/:institutionId')
  async listSessions(@Param() params: unknown, @Req() req: any) {
    const parsed = SessionParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const userId: string = req.user?.id ?? req.user?.sub ?? 'anonymous';

    return this.conversationHistory.listSessions(
      parsed.data.institutionId,
      userId,
    );
  }

  /**
   * GET /api/ai-advisor/sessions/:institutionId/:sessionId
   * Get the full history for a specific chat session.
   */
  @Get('sessions/:institutionId/:sessionId')
  async getSessionHistory(@Param() params: unknown) {
    const parsed = SessionHistoryParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.conversationHistory.getSessionHistory(
      parsed.data.institutionId,
      parsed.data.sessionId,
      50, // Return up to 50 messages for full session view
    );
  }

  /**
   * DELETE /api/ai-advisor/sessions/:sessionId
   * Delete a chat session and all its messages.
   */
  @Delete('sessions/:sessionId')
  @HttpCode(204)
  async deleteSession(@Param() params: unknown) {
    const parsed = DeleteSessionParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    await this.conversationHistory.deleteSession(parsed.data.sessionId);
  }
}
