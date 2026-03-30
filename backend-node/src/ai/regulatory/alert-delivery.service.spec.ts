import { AlertDeliveryService } from './alert-delivery.service';

describe('AlertDeliveryService', () => {
  let service: AlertDeliveryService;
  const mockPrisma = {
    institution: { findMany: jest.fn() },
    institutionAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    service = new AlertDeliveryService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should deliver alerts to matching institutions', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', balanceSheetItems: [{ subcategory: 'liquidity' }] },
    ]);
    mockPrisma.institutionAlert.create.mockResolvedValue({});

    const impact = {
      severity: 'HIGH',
      affectedSubcategories: ['liquidity'],
      requirements: ['New LCR minimum', 'Report quarterly'],
      keyQuote: 'test quote',
    };

    const count = await service.mapAndDeliverToAllInstitutions(
      'pub-1',
      impact as any,
    );
    expect(count).toBe(1);
    expect(mockPrisma.institutionAlert.create).toHaveBeenCalledTimes(1);
  });

  it('should skip institutions with no matching subcategories for non-HIGH severity', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', balanceSheetItems: [{ subcategory: 'mortgages' }] },
    ]);

    const impact = {
      severity: 'LOW',
      affectedSubcategories: ['derivatives'],
      requirements: ['Test req'],
      keyQuote: 'test',
    };

    const count = await service.mapAndDeliverToAllInstitutions(
      'pub-2',
      impact as any,
    );
    expect(count).toBe(0);
    expect(mockPrisma.institutionAlert.create).not.toHaveBeenCalled();
  });

  it('should return institution alerts', async () => {
    mockPrisma.institutionAlert.findMany.mockResolvedValue([{ id: 'a1' }]);
    const result = await service.getInstitutionAlerts('inst-1');
    expect(result).toEqual([{ id: 'a1' }]);
  });

  it('should mark alert as read', async () => {
    mockPrisma.institutionAlert.update.mockResolvedValue({
      id: 'a1',
      readAt: new Date(),
    });
    const result = await service.markRead('a1');
    expect(result.readAt).toBeDefined();
  });

  it('should dismiss an alert', async () => {
    mockPrisma.institutionAlert.update.mockResolvedValue({
      id: 'a1',
      dismissedAt: new Date(),
    });
    const result = await service.dismiss('a1');
    expect(result.dismissedAt).toBeDefined();
  });
});
