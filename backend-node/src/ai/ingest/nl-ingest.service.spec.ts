import { NLIngestService } from './nl-ingest.service';

describe('NLIngestService', () => {
  let service: NLIngestService;
  const mockPrisma = {
    balanceSheetItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };

  beforeEach(() => {
    service = new NLIngestService(mockPrisma as any);
    delete process.env.ANTHROPIC_API_KEY;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('ingestDocument extracts items from plain text using heuristics', async () => {
    const content = [
      'Fixed Mortgages $50,000',
      'Commercial Loans $30,000',
      'Core Deposits $40,000',
    ].join('\n');
    const result = await service.ingestDocument(
      'inst-1',
      'balance.txt',
      content,
      'text/plain',
    );
    expect(result.itemsCreated).toBe(3);
    expect(result.extractedCategories.assets).toBeGreaterThanOrEqual(0);
    expect(result.extractedCategories.liabilities).toBeGreaterThanOrEqual(0);
  });

  it('ingestDocument returns zero items for empty content', async () => {
    const result = await service.ingestDocument(
      'inst-1',
      'empty.txt',
      'No numbers here at all',
      'text/plain',
    );
    expect(result.itemsCreated).toBe(0);
    expect(result.warnings).toContain(
      'No balance sheet items detected in document.',
    );
  });

  it('ingestDocument classifies deposits as liabilities', async () => {
    const content = 'Savings Deposits $25,000\nShared deposits $10,000\n';
    mockPrisma.balanceSheetItem.createMany.mockResolvedValueOnce({ count: 2 });
    const result = await service.ingestDocument(
      'inst-1',
      'deposits.txt',
      content,
      'text/plain',
    );
    expect(result.extractedCategories.liabilities).toBeGreaterThan(0);
  });

  it('ingestDocument handles Buffer content', async () => {
    const content = Buffer.from('Cash $5,000\nLoans $15,000');
    mockPrisma.balanceSheetItem.createMany.mockResolvedValueOnce({ count: 2 });
    const result = await service.ingestDocument(
      'inst-1',
      'bs.txt',
      content,
      'text/plain',
    );
    expect(result.itemsCreated).toBe(2);
  });

  it('ingestDocument deletes existing items before creating new ones', async () => {
    const content = 'Loans $20,000';
    mockPrisma.balanceSheetItem.createMany.mockResolvedValueOnce({ count: 1 });
    await service.ingestDocument('inst-1', 'test.txt', content, 'text/plain');
    expect(mockPrisma.balanceSheetItem.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1' },
    });
  });
});
