import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

// ─── Webhook Event Types ────────────────────────────────────

export type WebhookEventType =
  | 'policy.breach'
  | 'rate.move'
  | 'compliance.deadline'
  | 'report.ready'
  | 'ews.alert'
  | 'analysis.complete'
  | 'camel.downgrade';

export interface WebhookDeliveryResult {
  subscriptionId: string;
  url: string;
  eventType: string;
  statusCode: number | null;
  success: boolean;
  error?: string;
  deliveredAt: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Manage Subscriptions ─────────────────────────────────

  async createSubscription(
    institutionId: string,
    data: {
      url: string;
      events: WebhookEventType[];
    },
  ) {
    const secretKey = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhookSubscription.create({
      data: {
        institutionId,
        url: data.url,
        events: data.events,
        secretKey,
      },
    });
  }

  async listSubscriptions(institutionId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { institutionId, isActive: true },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveredAt: true,
        failureCount: true,
        createdAt: true,
      },
    });
  }

  async deleteSubscription(subscriptionId: string) {
    await this.prisma.webhookSubscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
    return { deleted: true };
  }

  // ─── Dispatch Events ──────────────────────────────────────

  async dispatchEvent(
    institutionId: string,
    eventType: WebhookEventType,
    payload: Record<string, any>,
  ): Promise<WebhookDeliveryResult[]> {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { institutionId, isActive: true, events: { has: eventType } },
    });

    const results: WebhookDeliveryResult[] = [];

    for (const sub of subscriptions) {
      const result = await this.deliverWebhook(sub, eventType, payload);
      results.push(result);

      // Update subscription status
      if (result.success) {
        await this.prisma.webhookSubscription.update({
          where: { id: sub.id },
          data: { lastDeliveredAt: new Date(), failureCount: 0 },
        });
      } else {
        const newFailureCount = sub.failureCount + 1;
        await this.prisma.webhookSubscription.update({
          where: { id: sub.id },
          data: {
            failureCount: newFailureCount,
            isActive: newFailureCount < 10, // disable after 10 consecutive failures
          },
        });
      }
    }

    return results;
  }

  // ─── Private: Deliver Single Webhook ──────────────────────

  private async deliverWebhook(
    subscription: any,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify({
      event: eventType,
      institutionId: subscription.institutionId,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = crypto
      .createHmac('sha256', subscription.secretKey)
      .update(body)
      .digest('hex');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CERNIQ-Signature': `sha256=${signature}`,
          'X-CERNIQ-Event': eventType,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        subscriptionId: subscription.id,
        url: subscription.url,
        eventType,
        statusCode: response.status,
        success: response.status >= 200 && response.status < 300,
        deliveredAt: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.warn(
        `Webhook delivery failed to ${subscription.url}: ${err.message}`,
      );
      return {
        subscriptionId: subscription.id,
        url: subscription.url,
        eventType,
        statusCode: null,
        success: false,
        error: err.message,
        deliveredAt: new Date().toISOString(),
      };
    }
  }
}
