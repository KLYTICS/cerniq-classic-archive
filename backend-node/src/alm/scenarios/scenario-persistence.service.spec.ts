import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ScenarioPersistenceService } from './scenario-persistence.service';

describe('ScenarioPersistenceService', () => {
  let service: ScenarioPersistenceService;
  const mockPrisma = {
    savedScenario: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    service = new ScenarioPersistenceService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save a scenario', async () => {
    mockPrisma.savedScenario.create.mockResolvedValue({ id: 'sc-1', name: 'Rate Shock +200' });
    const result = await service.saveScenario('user-1', {
      institutionId: 'inst-1',
      name: 'Rate Shock +200',
      scenarioType: 'rate_shock',
      parameters: { shockBps: 200 },
    });
    expect(result.id).toBe('sc-1');
  });

  it('should list scenarios with pagination', async () => {
    mockPrisma.savedScenario.findMany.mockResolvedValue([{ id: 'sc-1' }]);
    mockPrisma.savedScenario.count.mockResolvedValue(1);
    const result = await service.listScenarios('inst-1', { page: 1, pageSize: 10 });
    expect(result.items.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('should throw NotFoundException for missing scenario', async () => {
    mockPrisma.savedScenario.findUnique.mockResolvedValue(null);
    await expect(service.getScenario('missing')).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException for invalid compare count', async () => {
    await expect(service.compareScenarios(['sc-1'])).rejects.toThrow(BadRequestException);
  });

  it('should delete scenario and return confirmation', async () => {
    mockPrisma.savedScenario.findUnique.mockResolvedValue({ id: 'sc-1' });
    mockPrisma.savedScenario.delete.mockResolvedValue({});
    const result = await service.deleteScenario('sc-1');
    expect(result.deleted).toBe(true);
    expect(result.id).toBe('sc-1');
  });
});
