import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { AlmAnalystService } from './alm-analyst.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/analyst')
@UseGuards(AuthGuard)
export class AlmAnalystController {
  private readonly logger = new Logger(AlmAnalystController.name);

  constructor(private readonly analyst: AlmAnalystService) {}

  /**
   * POST /api/analyst/:institutionId/message
   *
   * Returns the analyst response as a JSON payload.
   * For SSE streaming, the frontend uses the existing advisor SSE endpoint.
   * This endpoint is for non-streaming tool-use queries.
   */
  @Post(':institutionId/message')
  @HttpCode(HttpStatus.OK)
  async processMessage(
    @Param('institutionId') institutionId: string,
    @Body() body: { message: string; tool?: string },
  ) {
    this.logger.log(
      `Analyst query for ${institutionId}: "${body.message?.slice(0, 80)}..."`,
    );

    const rl = this.analyst.checkRateLimit(institutionId);
    if (!rl.allowed) {
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Ha alcanzado el límite de 20 consultas diarias. El límite se restablece a medianoche hora de Puerto Rico.',
          queriesUsed: rl.used,
          queriesMax: rl.max,
        },
        429,
      );
    }

    // If a specific tool is requested, dispatch directly
    if (body.tool) {
      const result = await this.analyst.executeTool(institutionId, body.tool);
      return { type: 'tool_result', name: body.tool, data: JSON.parse(result) };
    }

    // Otherwise build the system prompt (useful for debug/preview)
    const systemPrompt = await this.analyst.buildSystemPrompt(institutionId);
    return { type: 'system_prompt', prompt: systemPrompt };
  }

  @Get(':institutionId/rate-limit')
  getRateLimit(@Param('institutionId') institutionId: string) {
    return this.analyst.getRateLimitStatus(institutionId);
  }

  @Post(':institutionId/insights')
  @HttpCode(HttpStatus.CREATED)
  async saveInsight(
    @Param('institutionId') institutionId: string,
    @Body() body: { message: string; savedBy: string; tags?: string[] },
  ) {
    return this.analyst.saveInsight(
      institutionId,
      body.message,
      body.savedBy,
      body.tags ?? [],
    );
  }
}
