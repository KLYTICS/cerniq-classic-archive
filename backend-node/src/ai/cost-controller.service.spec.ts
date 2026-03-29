import { AICostControllerService } from './cost-controller.service';

describe('AICostControllerService', () => {
  let service: AICostControllerService;
  const mockPrisma = {
    institution: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'inst-1',
        workspace: {
          owner: {
            subscription: { tier: 'silver' },
          },
        },
      }),
    },
    usageMeterEvent: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(() => {
    service = new AICostControllerService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('selectModel returns primary model when usage is low', async () => {
    mockPrisma.usageMeterEvent.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 10 },
    });
    const result = await service.selectModel('inst-1');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.tier).toBe('primary');
    expect(result.budgetUsedPct).toBeLessThan(0.8);
  });

  it('selectModel falls back to Haiku when usage is 80-95%', async () => {
    // 250 tokens * 1000 = 250k tokens, which is silver budget
    // We need 80-95% usage: 200-237.5 units
    mockPrisma.usageMeterEvent.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 210 },
    });
    const result = await service.selectModel('inst-1');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.tier).toBe('fallback1');
  });

  it('selectModel falls back to GPT-4o-mini when near budget limit', async () => {
    mockPrisma.usageMeterEvent.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 245 },
    });
    const result = await service.selectModel('inst-1');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.tier).toBe('fallback2');
  });

  it('recordUsage creates a usage meter event', async () => {
    await service.recordUsage('inst-1', 500, 200);
    expect(mockPrisma.usageMeterEvent.create).toHaveBeenCalledWith({
      data: {
        institutionId: 'inst-1',
        eventType: 'ai_token_1k',
        quantity: 1,
      },
    });
  });

  it('gold tier always returns primary model', async () => {
    mockPrisma.institution.findUnique.mockResolvedValueOnce({
      id: 'inst-gold',
      workspace: { owner: { subscription: { tier: 'gold' } } },
    });
    mockPrisma.usageMeterEvent.aggregate.mockResolvedValueOnce({
      _sum: { quantity: 999 },
    });
    const result = await service.selectModel('inst-gold');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.reason).toContain('budget used');
  });
});
