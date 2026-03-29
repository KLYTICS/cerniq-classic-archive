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
    mockPrisma.webhookSubscription.update.mockResolvedValue({ isActive: false });
    const result = await service.deleteSubscription('wh-1');
    expect(result.deleted).toBe(true);
    expect(mockPrisma.webhookSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });
});
