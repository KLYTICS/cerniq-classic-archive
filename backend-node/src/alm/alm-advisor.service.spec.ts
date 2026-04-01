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

  it('should enforce daily limit in Spanish', async () => {
    (service as any).anthropic = { messages: { create: jest.fn() } };
    const dayKey = `inst-1:${new Date().toISOString().slice(0, 10)}`;
    (service as any).dailyCounts.set(dayKey, 20);

    const result = await service.ask('inst-1', 'Prueba', [], 'es');
    expect(result.response).toContain('limite diario');
    expect(result.tokensUsed).toBe(0);
  });

  it('should build English system prompt with institution data', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue({
      examReadinessScore: 85,
      overallStatus: 'GOOD',
      summary: {
        totalAssets: 500,
        nim: 3.5,
        capitalRatio: 10.2,
        loanToShareRatio: 65,
        liquidityRatio: 22,
        earningAssetsYield: 4.5,
        costOfFunds: 1.2,
        largestSectorName: 'Real Estate',
        largestSectorPct: 35,
      },
      ratios: [
        { name: 'Capital', nameEs: 'Capital', value: 10.2, unit: '%', status: 'pass' },
      ],
    });
    mockAlmEnterprise.getALMSummary.mockResolvedValue({
      institution: { name: 'Test CU', type: 'credit_union' },
      durationGap: { durationGap: 1.5, assetDuration: 3.2, liabilityDuration: 1.7, riskProfile: 'moderate' },
      niiSensitivity: { baseNII: 12.5, riskRating: 'moderate' },
      liquidity: { lcr: 120, buffer: 5, hqla: 80, netOutflows: 60, status: 'compliant' },
      riskScore: 45,
      topRisks: ['Duration mismatch'],
      recommendations: ['Reduce gap'],
    });

    const prompt = await service.buildSystemPrompt('inst-1', 'en');
    expect(prompt).toContain('Test CU');
    expect(prompt).toContain('Duration gap');
    expect(prompt).toContain('COSSEC');
    expect(prompt).toContain('500.0');
  });

  it('should build Spanish system prompt with institution data', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue({
      examReadinessScore: 85,
      overallStatus: 'BUENO',
      summary: {
        totalAssets: 300,
        nim: 3.0,
        capitalRatio: 9.0,
        loanToShareRatio: 60,
        liquidityRatio: 20,
        earningAssetsYield: 4.0,
        costOfFunds: 1.0,
        largestSectorName: 'Hipotecario',
        largestSectorPct: 40,
      },
      ratios: [
        { name: 'Capital', nameEs: 'Capital', value: 9.0, unit: '%', status: 'warning' },
      ],
    });
    mockAlmEnterprise.getALMSummary.mockResolvedValue({
      institution: { name: 'Cooperativa Test', type: 'credit_union' },
      durationGap: { durationGap: 2.0, assetDuration: 4.0, liabilityDuration: 2.0, riskProfile: 'elevado' },
      niiSensitivity: { baseNII: 10.0, riskRating: 'elevado' },
      liquidity: { lcr: 110, buffer: 2, hqla: 60, netOutflows: 50, status: 'warning' },
      riskScore: 55,
      topRisks: ['Riesgo de tasa'],
      recommendations: ['Reducir brecha'],
    });

    const prompt = await service.buildSystemPrompt('inst-1', 'es');
    expect(prompt).toContain('Cooperativa Test');
    expect(prompt).toContain('Brecha de duracion');
    expect(prompt).toContain('COSSEC');
    expect(prompt).toContain('REGLAS');
  });

  it('should handle Anthropic API error gracefully (EN)', async () => {
    (service as any).anthropic = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API timeout')),
      },
    };

    const result = await service.ask('inst-1', 'Test query', [], 'en');
    expect(result.response).toContain('error occurred');
    expect(result.tokensUsed).toBe(0);
  });

  it('should handle Anthropic API error gracefully (ES)', async () => {
    (service as any).anthropic = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('API timeout')),
      },
    };

    const result = await service.ask('inst-1', 'Consulta', [], 'es');
    expect(result.response).toContain('error al procesar');
    expect(result.tokensUsed).toBe(0);
  });

  it('should return AI response with token count', async () => {
    (service as any).anthropic = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Your duration gap is 1.5 years.' }],
          usage: { input_tokens: 500, output_tokens: 100 },
        }),
      },
    };

    const result = await service.ask('inst-1', 'What is my risk?', [], 'en');
    expect(result.response).toContain('duration gap');
    expect(result.tokensUsed).toBe(600);
  });

  it('should pass conversation history to the API', async () => {
    const createMock = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    (service as any).anthropic = { messages: { create: createMock } };

    await service.ask(
      'inst-1',
      'Follow-up question',
      [{ role: 'user', content: 'First question' }, { role: 'assistant', content: 'First answer' }],
      'en',
    );

    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3); // 2 history + 1 new
    expect(callArgs.messages[0].content).toBe('First question');
    expect(callArgs.messages[2].content).toBe('Follow-up question');
  });
});
