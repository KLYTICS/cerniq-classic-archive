import { AlmAdvisorService } from './alm-advisor.service';

describe('AlmAdvisorService', () => {
  let service: AlmAdvisorService;
  const mockPrisma = {} as any;
  const mockAlmEnterprise = {
    getCOSSECCompliance: jest.fn(),
    getALMSummary: jest.fn(),
  } as any;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    service = new AlmAdvisorService(mockPrisma, mockAlmEnterprise);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return unavailable message when API key is not set (ES)', async () => {
    const result = await service.ask('inst-1', 'Hola', [], 'es');
    expect(result.response).toContain('no esta disponible');
    expect(result.tokensUsed).toBe(0);
  });

  it('should return unavailable message when API key is not set (EN)', async () => {
    const result = await service.ask('inst-1', 'Hello', [], 'en');
    expect(result.response).toContain('not available');
    expect(result.tokensUsed).toBe(0);
  });

  it('should build fallback system prompt when data loading fails (ES)', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockRejectedValue(
      new Error('DB error'),
    );
    mockAlmEnterprise.getALMSummary.mockRejectedValue(new Error('DB error'));

    const prompt = await service.buildSystemPrompt('inst-1', 'es');
    expect(prompt).toContain('Asesor de Riesgo IA');
    expect(prompt).toContain('No se pudieron cargar');
  });

  it('should build fallback system prompt when data loading fails (EN)', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockRejectedValue(
      new Error('DB error'),
    );
    mockAlmEnterprise.getALMSummary.mockRejectedValue(new Error('DB error'));

    const prompt = await service.buildSystemPrompt('inst-1', 'en');
    expect(prompt).toContain('AI Risk Advisor');
    expect(prompt).toContain('could not be loaded');
  });

  it('should enforce daily limit message when anthropic is available', async () => {
    // Simulate having the anthropic SDK available
    (service as any).anthropic = { messages: { create: jest.fn() } };
    // Fill up daily limit by manipulating the private map
    const dayKey = `inst-1:${new Date().toISOString().slice(0, 10)}`;
    (service as any).dailyCounts.set(dayKey, 20);

    const result = await service.ask('inst-1', 'Test', [], 'en');
    expect(result.response).toContain('daily limit');
    expect(result.tokensUsed).toBe(0);
  });
});
