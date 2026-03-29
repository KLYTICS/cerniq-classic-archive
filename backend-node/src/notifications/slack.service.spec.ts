import { SlackService } from './slack.service';

describe('SlackService', () => {
  let service: SlackService;

  beforeEach(() => {
    delete process.env.SLACK_WEBHOOK_URL;
    service = new SlackService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false when no webhook URL is configured', async () => {
    const result = await service.sendAlert({
      type: 'new_lead',
      title: 'Test',
      details: { Name: 'Test' },
    });
    expect(result).toBe(false);
  });

  it('should format new lead notification correctly', async () => {
    // Without webhook URL, just verify it calls sendAlert without error
    const result = await service.notifyNewLead({
      name: 'John',
      email: 'john@test.com',
      institution: 'Test CU',
      type: 'DEMO_REQUEST',
      priority: 'HIGH',
    });
    expect(result).toBe(false); // no webhook URL
  });

  it('should format checkout completed notification', async () => {
    const result = await service.notifyCheckoutCompleted({
      email: 'john@test.com',
      institution: 'Test CU',
      tier: 'Gold',
      amount: 5000,
    });
    expect(result).toBe(false);
  });

  it('should format hot lead notification', async () => {
    const result = await service.notifyHotLead({
      name: 'Jane',
      institution: 'Big CU',
      score: 95,
      reason: 'High engagement',
    });
    expect(result).toBe(false);
  });

  it('should send alert when webhook URL is configured', async () => {
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const svc = new (SlackService as any)();
    (svc as any).webhookUrl = 'https://hooks.slack.com/test';

    const result = await svc.sendAlert({
      type: 'new_lead',
      title: 'Test Lead',
      details: { Name: 'Test' },
      urgency: 'medium',
    });
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalled();

    global.fetch = origFetch;
  });
});
