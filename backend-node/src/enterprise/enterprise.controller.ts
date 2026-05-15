import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  Headers,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EnterpriseBatchService } from './enterprise-batch.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { PrismaService } from '../prisma.service';
import {
  CreateBatchBodySchema,
  BatchIdParamSchema,
  ListBatchesQuerySchema,
  parseOrThrow,
} from './enterprise.dto';

/**
 * Enterprise API Controller — $2,500/mo tier.
 * Provides bulk report generation, batch management, and webhook delivery logs.
 * All endpoints require API key authentication via X-Api-Key header.
 */
@Controller('api/v1/enterprise')
export class EnterpriseController {
  private readonly logger = new Logger(EnterpriseController.name);

  constructor(
    private readonly batchService: EnterpriseBatchService,
    private readonly webhookService: WebhookDeliveryService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Auth helper ────────────────────────────────────────────────────────

  private async validateApiKey(apiKey: string | undefined): Promise<void> {
    if (!apiKey) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }
    if (apiKey.length < 16) {
      throw new UnauthorizedException('Invalid API key');
    }
    const crypto = await import('node:crypto');
    const incomingHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: incomingHash },
    });
    if (
      !key ||
      key.revokedAt ||
      (key.expiresAt && key.expiresAt < new Date())
    ) {
      throw new UnauthorizedException('Invalid API key');
    }
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
  }

  // ─── POST /api/v1/enterprise/reports/bulk ───────────────────────────────

  @Post('reports/bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Headers('x-api-key') apiKey: string,
    @Body() body: unknown,
  ) {
    await this.validateApiKey(apiKey);

    let dto;
    try {
      dto = parseOrThrow(CreateBatchBodySchema, body);
    } catch (err: any) {
      throw new BadRequestException(err.issues ?? err.message);
    }

    const batch = await this.batchService.createBatch({
      ...dto,
      requestedBy: apiKey, // In production, resolve to user from API key
    });

    this.logger.log({
      msg: 'Bulk report batch created',
      batchId: batch.id,
      organizationId: dto.organizationId,
    });

    return {
      batchId: batch.id,
      status: batch.status,
      totalItems: batch.totalItems,
      createdAt: batch.createdAt.toISOString(),
      _links: {
        status: `/api/v1/enterprise/reports/batch/${batch.id}/status`,
        details: `/api/v1/enterprise/reports/batch/${batch.id}`,
        cancel: `/api/v1/enterprise/reports/batch/${batch.id}`,
      },
    };
  }

  // ─── GET /api/v1/enterprise/reports/batch/:batchId ──────────────────────

  @Get('reports/batch/:batchId')
  async getBatch(
    @Headers('x-api-key') apiKey: string,
    @Param() params: unknown,
  ) {
    await this.validateApiKey(apiKey);

    const { batchId } = parseOrThrow(BatchIdParamSchema, params);
    const batch = await this.batchService.getBatch(batchId);

    return {
      batchId: batch.id,
      status: batch.status,
      batchType: batch.batchType,
      priority: batch.priority,
      totalItems: batch.totalItems,
      completedItems: batch.completedItems,
      failedItems: batch.failedItems,
      progressPercent: batch.progressPercent,
      estimatedCompletionAt: batch.estimatedCompletionAt ?? null,
      outputFormat: batch.outputFormat,
      errorLog: batch.errorLog,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      completedAt: batch.completedAt?.toISOString() ?? null,
    };
  }

  // ─── GET /api/v1/enterprise/reports/batch/:batchId/status ───────────────
  // Lightweight polling endpoint — returns only status fields.

  @Get('reports/batch/:batchId/status')
  async getBatchStatus(
    @Headers('x-api-key') apiKey: string,
    @Param() params: unknown,
  ) {
    await this.validateApiKey(apiKey);

    const { batchId } = parseOrThrow(BatchIdParamSchema, params);
    const batch = await this.batchService.getBatch(batchId);

    return {
      batchId: batch.id,
      status: batch.status,
      progressPercent: batch.progressPercent,
      completedItems: batch.completedItems,
      failedItems: batch.failedItems,
      totalItems: batch.totalItems,
      estimatedCompletionAt: batch.estimatedCompletionAt ?? null,
    };
  }

  // ─── DELETE /api/v1/enterprise/reports/batch/:batchId ───────────────────

  @Delete('reports/batch/:batchId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelBatch(
    @Headers('x-api-key') apiKey: string,
    @Param() params: unknown,
  ) {
    await this.validateApiKey(apiKey);

    const { batchId } = parseOrThrow(BatchIdParamSchema, params);
    await this.batchService.cancelBatch(batchId);
  }

  // ─── GET /api/v1/enterprise/webhooks/:batchId ───────────────────────────

  @Get('webhooks/:batchId')
  async getWebhookLog(
    @Headers('x-api-key') apiKey: string,
    @Param() params: unknown,
  ) {
    await this.validateApiKey(apiKey);

    const { batchId } = parseOrThrow(BatchIdParamSchema, params);
    const logs = await this.webhookService.getDeliveryLog(batchId);

    return {
      batchId,
      deliveries: logs.map((log) => ({
        id: log.id,
        event: log.event,
        attempt: log.attempt,
        maxAttempts: log.maxAttempts,
        status: log.status,
        httpStatus: log.httpStatus,
        error: log.error,
        createdAt: log.createdAt.toISOString(),
        deliveredAt: log.deliveredAt?.toISOString() ?? null,
        nextRetryAt: log.nextRetryAt?.toISOString() ?? null,
      })),
    };
  }
}
