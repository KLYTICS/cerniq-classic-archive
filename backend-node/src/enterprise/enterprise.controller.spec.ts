import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EnterpriseController } from './enterprise.controller';
import { ApiKeyAuthGuard } from '../api-v1/guards/api-key-auth.guard';
import type { EnterpriseBatchService } from './enterprise-batch.service';
import type { WebhookDeliveryService } from './webhook-delivery.service';
import type { OrgMembershipGuard } from '../close/guards/org-membership.guard';

// Post-migration controller spec (commit 97e588da scaffold +
// migration #1 of 1 in this lane). The 5 admin-key behavior tests
// that used to exist on `controller.method('wrong-key')` are deleted —
// guards run at HTTP layer and direct method invocation bypasses them,
// so those tests no longer prove auth. Replaced with (a) the structural
// reflection lock guaranteeing `ApiKeyAuthGuard` is wired at class level,
// and (b) handler-delegation tests that exercise the post-guard happy
// path. The guard's own behavior (Bearer vs X-Api-Key, hash mismatch,
// revoked/expired keys, etc.) is covered by the 19-case suite in
// `api-v1/guards/api-key-auth.guard.spec.ts`.

describe('EnterpriseController', () => {
  // ─── Structural lock ───────────────────────────────────────────────────

  it('has ApiKeyAuthGuard wired at class level (reflection lock)', () => {
    // NestJS stores @UseGuards under '__guards__' metadata key.
    // The structural lock is the regression detector for "someone
    // dropped the decorator" — behavior-only tests would not detect
    // that because direct method invocation never goes through guards.
    const guards =
      Reflect.getMetadata('__guards__', EnterpriseController) ?? [];
    const names = guards.map((g: { name?: string }) => g?.name ?? String(g));
    expect(names).toContain('ApiKeyAuthGuard');
  });

  // ─── Handler delegation ────────────────────────────────────────────────

  let controller: EnterpriseController;
  let batchService: jest.Mocked<
    Pick<EnterpriseBatchService, 'createBatch' | 'getBatch' | 'cancelBatch'>
  >;
  let webhookService: jest.Mocked<
    Pick<WebhookDeliveryService, 'getDeliveryLog'>
  >;
  let orgMembership: jest.Mocked<Pick<OrgMembershipGuard, 'verifyMembership'>>;

  // A request shape with the same `apiUser` the guard would attach in prod.
  const authedReq = {
    apiUser: {
      userId: 'user-enterprise-1',
      email: 'enterprise@example.com',
      apiKeyId: 'key-1',
      keyPrefix: 'ck_live_',
      tier: 'partner' as const,
    },
    user: {
      access: { isMasterCeo: false },
    },
  };
  const masterCeoReq = {
    ...authedReq,
    user: { access: { isMasterCeo: true } },
  };

  beforeEach(() => {
    batchService = {
      createBatch: jest.fn(),
      getBatch: jest.fn(),
      cancelBatch: jest.fn(),
    };
    webhookService = {
      getDeliveryLog: jest.fn(),
    };
    orgMembership = {
      verifyMembership: jest.fn().mockResolvedValue(undefined),
    };
    controller = new EnterpriseController(
      batchService as unknown as EnterpriseBatchService,
      webhookService as unknown as WebhookDeliveryService,
      orgMembership as unknown as OrgMembershipGuard,
    );
  });

  // Proper RFC-4122 v4 UUIDs (Zod 4's `.uuid()` rejects placeholders like
  // `batch-1` and even `11111111-1111-1111-1111-111111111111` because the
  // variant digit must be 8/9/a/b — see 6b73eb24 §Zod-4-footgun).
  const UUID_BATCH = '8e8a7c7e-1234-4abc-9def-0123456789ab';
  const UUID_BATCH_2 = '9f9b8d8f-2345-4bcd-aef0-1234567890ac';
  const UUID_BATCH_3 = '0a0c9e9d-3456-4cde-bf01-23456789ab0d';
  const UUID_BATCH_4 = '1b1d0f0e-4567-4def-8012-3456789abcd0';
  const UUID_INST_1 = 'aaaaaaaa-1111-4111-8111-111111111111';
  const UUID_INST_2 = 'bbbbbbbb-2222-4222-9222-222222222222';
  const UUID_ORG = '550e8400-e29b-41d4-a716-446655440000';

  describe('POST /reports/bulk (createBatch)', () => {
    const validBody = {
      organizationId: UUID_ORG,
      batchType: 'BULK_REPORT' as const,
      priority: 'NORMAL' as const,
      institutionIds: [UUID_INST_1, UUID_INST_2],
      outputFormat: 'PDF' as const,
    };

    it('delegates to batchService.createBatch with resolved userId in requestedBy (fixes pre-migration raw-key leak)', async () => {
      const now = new Date();
      batchService.createBatch.mockResolvedValue({
        id: 'batch-1',
        status: 'PENDING',
        totalItems: 2,
        createdAt: now,
        // Other fields not asserted in this delegation test.
      } as never);

      await controller.createBatch(authedReq, validBody);

      // The pre-migration controller passed `requestedBy: apiKey` (the
      // raw API key string). This assertion locks the fix: the resolved
      // userId from the guard's apiUser context must flow through.
      expect(batchService.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedBy: 'user-enterprise-1',
        }),
      );
      // And critically NOT the raw apiKey or any value resembling one.
      expect(batchService.createBatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          requestedBy: expect.stringMatching(/^(ck_live_|sk-|Bearer\s)/),
        }),
      );
    });

    it('throws BadRequestException when body fails Zod validation', async () => {
      await expect(
        controller.createBatch(authedReq, { not: 'a valid batch body' }),
      ).rejects.toThrow(BadRequestException);
      expect(batchService.createBatch).not.toHaveBeenCalled();
      // Membership check should NOT fire on a malformed body — Zod
      // validation must short-circuit the auth-ordering layer.
      expect(orgMembership.verifyMembership).not.toHaveBeenCalled();
    });

    it('verifies org membership BEFORE invoking batchService.createBatch (IDOR closure ordering)', async () => {
      // Mock invocationCallOrder captures call order on a per-mock basis.
      // The intent: a Forbidden from membership must skip batch creation,
      // which is only guaranteed if verifyMembership runs strictly before
      // createBatch. The ordering assertion catches a future refactor
      // that accidentally reverses the two.
      const now = new Date();
      batchService.createBatch.mockResolvedValue({
        id: 'batch-ordering',
        status: 'PENDING',
        totalItems: 2,
        createdAt: now,
      } as never);

      await controller.createBatch(authedReq, validBody);

      expect(orgMembership.verifyMembership).toHaveBeenCalledTimes(1);
      expect(orgMembership.verifyMembership).toHaveBeenCalledWith(
        UUID_ORG,
        'user-enterprise-1',
        false,
      );
      const memOrder =
        orgMembership.verifyMembership.mock.invocationCallOrder[0];
      const batchOrder = batchService.createBatch.mock.invocationCallOrder[0];
      expect(memOrder).toBeLessThan(batchOrder);
    });

    it('propagates ForbiddenException from verifyMembership and skips batch creation', async () => {
      orgMembership.verifyMembership.mockRejectedValue(
        new ForbiddenException('not authorized for this organization'),
      );

      await expect(
        controller.createBatch(authedReq, validBody),
      ).rejects.toThrow(ForbiddenException);
      // The bug-fix lock: a denied membership check MUST NOT create the
      // batch. Without this assertion, a Forbidden could bubble up while
      // the side effect (batch row insert) still landed.
      expect(batchService.createBatch).not.toHaveBeenCalled();
    });

    it('forwards isMasterCeo=true when the request carries master-CEO access (platform override)', async () => {
      const now = new Date();
      batchService.createBatch.mockResolvedValue({
        id: 'batch-master',
        status: 'PENDING',
        totalItems: 2,
        createdAt: now,
      } as never);

      await controller.createBatch(masterCeoReq, validBody);

      // The guard internally fast-paths on isMasterCeo=true; the
      // controller's responsibility is just to forward the flag honestly.
      expect(orgMembership.verifyMembership).toHaveBeenCalledWith(
        UUID_ORG,
        'user-enterprise-1',
        true,
      );
    });
  });

  describe('GET /reports/batch/:batchId (getBatch)', () => {
    it('delegates to batchService.getBatch with parsed batchId', async () => {
      const now = new Date();
      batchService.getBatch.mockResolvedValue({
        id: 'batch-42',
        status: 'COMPLETED',
        batchType: 'BULK_REPORT',
        priority: 'NORMAL',
        totalItems: 5,
        completedItems: 5,
        failedItems: 0,
        progressPercent: 100,
        estimatedCompletionAt: null,
        outputFormat: 'PDF',
        errorLog: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      } as never);

      const result = await controller.getBatch({ batchId: UUID_BATCH });

      expect(batchService.getBatch).toHaveBeenCalledWith(UUID_BATCH);
      expect(result.batchId).toBe('batch-42');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('GET /reports/batch/:batchId/status (getBatchStatus)', () => {
    it('returns the lightweight polling shape', async () => {
      const now = new Date();
      batchService.getBatch.mockResolvedValue({
        id: 'batch-7',
        status: 'PROCESSING',
        progressPercent: 60,
        completedItems: 3,
        failedItems: 0,
        totalItems: 5,
        estimatedCompletionAt: null,
        // Heavy fields the polling shape should NOT echo back:
        batchType: 'BULK_REPORT',
        priority: 'NORMAL',
        outputFormat: 'PDF',
        errorLog: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      } as never);

      const result = await controller.getBatchStatus({ batchId: UUID_BATCH_2 });

      // Polling shape exposes only the small set defined in the handler.
      expect(result).toEqual({
        batchId: 'batch-7',
        status: 'PROCESSING',
        progressPercent: 60,
        completedItems: 3,
        failedItems: 0,
        totalItems: 5,
        estimatedCompletionAt: null,
      });
      // outputFormat, errorLog, createdAt etc. intentionally absent.
      expect(result).not.toHaveProperty('outputFormat');
      expect(result).not.toHaveProperty('errorLog');
    });
  });

  describe('DELETE /reports/batch/:batchId (cancelBatch)', () => {
    it('delegates to batchService.cancelBatch and returns void', async () => {
      batchService.cancelBatch.mockResolvedValue(undefined as never);

      const result = await controller.cancelBatch({ batchId: UUID_BATCH_3 });

      expect(batchService.cancelBatch).toHaveBeenCalledWith(UUID_BATCH_3);
      expect(result).toBeUndefined();
    });
  });

  describe('GET /webhooks/:batchId (getWebhookLog)', () => {
    it('shapes webhook delivery log entries into the API response', async () => {
      const now = new Date('2026-05-16T00:00:00Z');
      webhookService.getDeliveryLog.mockResolvedValue([
        {
          id: 'log-1',
          event: 'batch.completed',
          attempt: 1,
          maxAttempts: 3,
          status: 'DELIVERED',
          httpStatus: 200,
          error: null,
          createdAt: now,
          deliveredAt: now,
          nextRetryAt: null,
        },
      ] as never);

      const result = await controller.getWebhookLog({ batchId: UUID_BATCH_4 });

      // getWebhookLog passes the parsed batchId from input to the service,
      // then echoes the same id into the response (unlike getBatch which
      // returns `batch.id` from the service result).
      expect(webhookService.getDeliveryLog).toHaveBeenCalledWith(UUID_BATCH_4);
      expect(result.batchId).toBe(UUID_BATCH_4);
      expect(result.deliveries).toHaveLength(1);
      expect(result.deliveries[0].createdAt).toBe(now.toISOString());
      expect(result.deliveries[0].deliveredAt).toBe(now.toISOString());
      expect(result.deliveries[0].nextRetryAt).toBeNull();
    });
  });
});

// Suppress unused import warning if Jest tree-shakes the type-only one.
void ApiKeyAuthGuard;
