import { CsvIngestV2Service } from './csv-ingest-v2.service';

describe('CsvIngestV2Service', () => {
  let service: CsvIngestV2Service;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      columnMappingMemory: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      balanceSheetItem: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    service = new CsvIngestV2Service(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('analyzes CSV and auto-maps columns by header names', async () => {
    const csv = `name,balance,rate,duration\nCash,50,0.01,0\nLoans,200,0.06,5`;
    const result = await service.analyzeCSV('inst_1', csv);

    expect(result.mappings).toHaveLength(4);
    const balanceMapping = result.mappings.find((m) => m.csvColumn === 'balance');
    expect(balanceMapping!.cerniqField).toBe('balance');
    expect(balanceMapping!.confidence).toBeGreaterThanOrEqual(0.85);

    const nameMapping = result.mappings.find((m) => m.csvColumn === 'name');
    expect(nameMapping!.cerniqField).toBe('name');

    expect(result.sampleData).toHaveLength(2);
    expect(result.ready).toBe(true);
  });

  it('returns not-ready when CSV has only header (no data rows)', async () => {
    const csv = 'name,balance';
    const result = await service.analyzeCSV('inst_1', csv);

    expect(result.ready).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('warns when no balance column is detected', async () => {
    const csv = `label,description\nA,First\nB,Second`;
    const result = await service.analyzeCSV('inst_1', csv);

    expect(result.warnings.some((w) => w.includes('balance'))).toBe(true);
    expect(result.ready).toBe(false);
  });

  it('commits ingestion and saves rows to DB', async () => {
    const csv = `name,balance,rate\ncash,50,0.01\nauto_loans,200,0.06`;
    const mappings = { name: 'subcategory', balance: 'balance', rate: 'rate' };

    const result = await service.commitIngestion('inst_1', csv, mappings);

    expect(result.rowsIngested).toBe(2);
    expect(prisma.balanceSheetItem.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst_1' },
    });
    expect(prisma.balanceSheetItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          institutionId: 'inst_1',
          balance: 50,
        }),
      ]),
    });
  });

  it('parseCSVLine handles quoted fields with commas', async () => {
    const csv = `name,balance\n"Savings, Regular",100\n"Time Deposit, 12mo",200`;
    const result = await service.analyzeCSV('inst_1', csv);

    expect(result.sampleData[0]['name']).toBe('Savings, Regular');
    expect(result.sampleData[1]['name']).toBe('Time Deposit, 12mo');
  });

  it('rejects CSV exceeding 50K rows', async () => {
    const header = 'name,balance';
    const rows = Array(50_002).fill('item,100');
    const csv = [header, ...rows].join('\n');

    const result = await service.analyzeCSV('inst_1', csv);
    expect(result.ready).toBe(false);
    expect(result.validationErrors[0].issue).toContain('50,000');
  });
});
