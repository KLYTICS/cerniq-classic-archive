import { Module } from '@nestjs/common';
import { EnterpriseBatchService } from './enterprise-batch.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { EnterpriseController } from './enterprise.controller';

/**
 * Enterprise Module — W3-7
 *
 * Provides the Enterprise tier ($2,500/mo) API surface:
 * - Bulk report generation with batch management
 * - Webhook delivery with HMAC-SHA256 signatures and retry logic
 * - API key authentication for programmatic access
 *
 * PrismaModule is @Global so it does not need an explicit import.
 * EmailModule is @Global so it does not need an explicit import.
 */
@Module({
  controllers: [EnterpriseController],
  providers: [EnterpriseBatchService, WebhookDeliveryService],
  exports: [EnterpriseBatchService],
})
export class EnterpriseModule {}
