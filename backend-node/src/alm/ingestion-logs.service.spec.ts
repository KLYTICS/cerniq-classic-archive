import { IngestionLogsService } from './ingestion-logs.service';

describe('IngestionLogsService', () => {
  let service: IngestionLogsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      ingestionLog: {
        create: jest
          .fn()
          .mockImplementation(({ data }: any) =>
            Promise.resolve({ id: 'log_123', ...data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      institution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inst_123' }),
      },
      reportJob: {
        findFirst: jest.fn().mockResolvedValue({ id: 'job_123' }),
      },
    };

    service = new IngestionLogsService(prisma);
  });

  it('records ingestion metadata with schema version and row counts', async () => {
    const result = await service.recordLog({
      userId: 'user_123',
      institutionId: 'inst_123',
      source: 'manual_upload',
      sourceFilename: 'balance-sheet.csv',
      status: 'IMPORTED',
      importedCount: 8,
      parseResult: {
        valid: true,
        items: [],
        errors: [],
        warnings: ['warning'],
        summary: {
          totalRows: 8,
          validRows: 8,
          errorRows: 0,
          totalAssets: 120,
          totalLiabilities: 110,
        },
      },
    });

    expect(prisma.ingestionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schemaVersion: 'alm_csv_v1',
          importedCount: 8,
          totalRows: 8,
        }),
      }),
    );
    expect(result.sourceFilename).toBe('balance-sheet.csv');
  });
});
