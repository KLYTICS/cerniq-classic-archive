import { Module } from '@nestjs/common';
import { EnterpriseBatchService } from './enterprise-batch.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { EnterpriseController } from './enterprise.controller';
import { ApiKeyAuthGuard } from '../api-v1/guards/api-key-auth.guard';

/**
 * Enterprise Module — W3-7
 *
 * Provides the Enterprise tier ($2,500/mo) API surface:
 * - Bulk report generation with batch management
 * - Webhook delivery with HMAC-SHA256 signatures and retry logic
 * - API key authentication via `ApiKeyAuthGuard` (Authorization: Bearer
 *   OR X-Api-Key — the guard supports both; see commit 97e588da)
 *
 * `ApiKeyAuthGuard` is registered here because @UseGuards() requires the
 * guard class to be resolvable in the consuming module's DI scope.
 * Its dependencies are globally available — PrismaService via @Global()
 * PrismaModule, and PlatformAccessService via @Global() AuthModule —
 * so no module imports are needed.
 *
 * PrismaModule + EmailModule + AuthModule are all @Global.
 */
@Module({
  controllers: [EnterpriseController],
  providers: [EnterpriseBatchService, WebhookDeliveryService, ApiKeyAuthGuard],
  exports: [EnterpriseBatchService],
})
export class EnterpriseModule {}
