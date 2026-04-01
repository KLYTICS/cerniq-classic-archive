import { BadRequestException } from '@nestjs/common';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;
  const mockPrisma = {
    webhookSubscription: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    service = new WebhookService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create subscription with valid HTTPS URL', async () => {
    mockPrisma.webhookSubscription.create.mockResolvedValue({ id: 'wh-1' });
    const result = await service.createSubscription('inst-1', {
      url: 'https://hooks.example.com/webhook',
      events: ['policy.breach'],
    });
    expect(result.id).toBe('wh-1');
  });

  it('should reject localhost URLs', async () => {
    await expect(
      service.createSubscription('inst-1', {
        url: 'https://localhost:3000/hook',
        events: ['rate.move'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject cloud metadata URLs', async () => {
    await expect(
      service.createSubscription('inst-1', {
        url: 'http://169.254.169.254/latest/meta-data',
        events: ['rate.move'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should list active subscriptions', async () => {
    mockPrisma.webhookSubscription.findMany.mockResolvedValue([{ id: 'wh-1' }]);
    const result = await service.listSubscriptions('inst-1');
    expect(result.length).toBe(1);
  });

  it('should soft-delete subscription by marking inactive', async () => {
    mockPrisma.webhookSubscription.update.mockResolvedValue({
      isActive: false,
    });
    const result = await service.deleteSubscription('wh-1');
    expect(result.deleted).toBe(true);
    expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });

  // ── SSRF validation: private IPs blocked ───────────────────
  describe('SSRF validation', () => {
    it('should reject 10.x.x.x private IP URLs', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'https://10.0.0.1/webhook',
          events: ['policy.breach'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 172.16.x.x private IP URLs', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'https://172.16.0.1/webhook',
          events: ['rate.move'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 192.168.x.x private IP URLs', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'https://192.168.1.1/hook',
          events: ['ews.alert'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 127.0.0.1 loopback', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'https://127.0.0.1:8080/hook',
          events: ['report.ready'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject 0.0.0.0 URL', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'http://0.0.0.0/hook',
          events: ['analysis.complete'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject metadata.google.internal', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'http://metadata.google.internal/computeMetadata/v1/',
          events: ['camel.downgrade'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid public HTTPS URLs', async () => {
      mockPrisma.webhookSubscription.create.mockResolvedValue({ id: 'wh-2' });
      const result = await service.createSubscription('inst-1', {
        url: 'https://api.example.com/webhooks/cerniq',
        events: ['policy.breach', 'rate.move'],
      });
      expect(result.id).toBe('wh-2');
    });

    it('should reject invalid URL format', async () => {
      await expect(
        service.createSubscription('inst-1', {
          url: 'not-a-url',
          events: ['policy.breach'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Coverage boost: dispatchEvent, deliverWebhook, retry ───
  describe('dispatchEvent', () => {
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('dispatches to matching subscriptions and updates success status', async () => {
      const sub = {
        id: 'wh-1',
        url: 'https://hooks.example.com/webhook',
        secretKey: 'abc123',
        institutionId: 'inst-1',
        failureCount: 0,
        events: ['policy.breach'],
        isActive: true,
      };
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([sub]);
      mockPrisma.webhookSubscription.update.mockResolvedValue({});

      // Mock fetch globally
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as any;

      const results = await service.dispatchEvent('inst-1', 'policy.breach', { detail: 'test' });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].statusCode).toBe(200);
      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failureCount: 0 }),
        }),
      );

      global.fetch = originalFetch;
    });

    it('returns empty results when no subscriptions match', async () => {
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([]);
      const results = await service.dispatchEvent('inst-1', 'rate.move', {});
      expect(results).toEqual([]);
    });

    it('increments failureCount on delivery failure and disables after 10', async () => {
      const sub = {
        id: 'wh-fail',
        url: 'https://hooks.example.com/webhook',
        secretKey: 'secret',
        institutionId: 'inst-1',
        failureCount: 9,
        events: ['ews.alert'],
        isActive: true,
      };
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([sub]);
      mockPrisma.webhookSubscription.update.mockResolvedValue({});

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ status: 500 }) as any;

      const results = await service.dispatchEvent('inst-1', 'ews.alert', {});

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      // After failure, failureCount increments to 10, subscription should be disabled
      expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureCount: 10,
            isActive: false,
          }),
        }),
      );

      global.fetch = originalFetch;
    });

    it('blocks SSRF URL during delivery and returns error result', async () => {
      const sub = {
        id: 'wh-ssrf',
        url: 'http://169.254.169.254/latest/meta-data',
        secretKey: 'secret',
        institutionId: 'inst-1',
        failureCount: 0,
        events: ['report.ready'],
        isActive: true,
      };
      mockPrisma.webhookSubscription.findMany.mockResolvedValue([sub]);
      mockPrisma.webhookSubscription.update.mockResolvedValue({});

      const results = await service.dispatchEvent('inst-1', 'report.ready', {});

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('SSRF');
    });
  });
});
