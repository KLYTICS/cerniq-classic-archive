import { GtmPipelineService } from './gtm-pipeline.service';
import { writeGtmArtifactBundle } from './gtm-run.store';

jest.mock('./gtm-run.store', () => ({
  writeGtmArtifactBundle: jest.fn().mockReturnValue('/tmp/gtm-runs/run-1'),
}));

describe('GtmPipelineService', () => {
  const prisma = {
    gtmPipelineRun: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const enrichment = {
    seedAllCooperativasFromCsv: jest.fn(),
    enrichAllProspects: jest.fn(),
    importLinkedInConnections: jest.fn(),
    buildFieldSalesPlaybook: jest.fn(),
  };

  let service: GtmPipelineService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.gtmPipelineRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.gtmPipelineRun.update.mockResolvedValue({});
    enrichment.seedAllCooperativasFromCsv.mockResolvedValue({
      created: 10,
      updated: 101,
      total: 111,
    });
    enrichment.enrichAllProspects.mockResolvedValue({
      cossecLinked: 14,
      almRiskScored: 14,
      intelligenceSynced: { created: 5, updated: 106 },
      leadsScored: 2,
      qualificationTop10: [],
    });
    enrichment.buildFieldSalesPlaybook.mockResolvedValue({
      totalInstitutions: 111,
      routes: [],
    });
    service = new GtmPipelineService(prisma as any, enrichment as any);
  });

  it('records a successful full pipeline run with artifacts', async () => {
    const result = await service.executeFullPipeline({
      triggerSource: 'cli',
      persistArtifacts: true,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.runId).toBe('run-1');
    expect(writeGtmArtifactBundle).toHaveBeenCalled();
    expect(prisma.gtmPipelineRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    );
  });

  it('marks the run failed when enrichment throws', async () => {
    enrichment.seedAllCooperativasFromCsv.mockRejectedValue(
      new Error('seed failed'),
    );

    await expect(
      service.executeFullPipeline({ triggerSource: 'api' }),
    ).rejects.toThrow('seed failed');

    expect(prisma.gtmPipelineRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'seed failed',
        }),
      }),
    );
  });
});
