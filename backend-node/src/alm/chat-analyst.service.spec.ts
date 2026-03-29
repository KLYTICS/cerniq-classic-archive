import { ChatAnalystService } from './chat-analyst.service';

describe('ChatAnalystService', () => {
  let service: ChatAnalystService;
  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
  const mockAlmEnterprise = {} as any;
  const mockAdvisorV2 = {
    computeHealthScore: jest.fn().mockResolvedValue({ overall: 75, label: 'SATISFACTORY' }),
  } as any;
  const mockCamelScorer = {
    scoreInstitution: jest.fn().mockResolvedValue({
      composite: 2,
      compositeRating: 'Satisfactory',
      compositeRatingEs: 'Satisfactorio',
      examReadiness: 'READY',
      components: [],
    }),
  } as any;

  beforeEach(() => {
    service = new ChatAnalystService(
      mockPrisma,
      mockAlmEnterprise,
      mockAdvisorV2,
      mockCamelScorer,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return available tools', () => {
    const tools = service.getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('desc');
  });

  it('should detect LCR tool from liquidity message', async () => {
    const result = await service.processMessage('inst-1', 'sess-1', 'What is our LCR?', 'en');
    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toContain('LCR');
  });

  it('should detect CAMEL tool from exam message', async () => {
    const result = await service.processMessage('inst-1', 'sess-2', 'Are we ready for the COSSEC exam?', 'en');
    expect(result.message.role).toBe('assistant');
    expect(result.message.content).toContain('CAMEL');
  });

  it('should return suggested follow-ups', async () => {
    const result = await service.processMessage('inst-1', 'sess-3', 'How are we doing?', 'en');
    expect(result.suggestedFollowups.length).toBeGreaterThan(0);
    expect(result.suggestedFollowupsEs.length).toBeGreaterThan(0);
  });

  it('should retrieve conversation history', async () => {
    await service.processMessage('inst-1', 'sess-4', 'hello', 'en');
    const history = service.getConversation('sess-4');
    expect(history.length).toBeGreaterThan(0);
  });
});
