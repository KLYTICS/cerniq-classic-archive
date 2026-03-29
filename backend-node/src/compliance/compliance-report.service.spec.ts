import { ComplianceReportService } from './compliance-report.service';

describe('ComplianceReportService', () => {
  let service: ComplianceReportService;
  const mockPrisma = {
    user: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  } as any;
  const mockSoc2Evidence = {
    collectEvidence: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ComplianceReportService(mockPrisma, mockSoc2Evidence);

    // Default mocks
    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.user.groupBy.mockResolvedValue([
      { role: 'OWNER', _count: { role: 2 } },
      { role: 'MEMBER', _count: { role: 8 } },
    ]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    mockPrisma.auditLog.count.mockResolvedValue(100);
    mockPrisma.auditLog.groupBy.mockResolvedValue([
      { action: 'login', _count: { action: 50 } },
    ]);
    mockSoc2Evidence.collectEvidence.mockResolvedValue({
      summary: { total: 10, pass: 9, fail: 1 },
      controls: [],
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateSOC2Evidence returns a complete report', async () => {
    const report = await service.generateSOC2Evidence();
    expect(report.reportId).toMatch(/^SOC2-/);
    expect(report.sections).toHaveProperty('accessControl');
    expect(report.sections).toHaveProperty('changeManagement');
    expect(report.sections).toHaveProperty('dataEncryption');
    expect(report.sections).toHaveProperty('auditTrail');
    expect(report.sections).toHaveProperty('availability');
    expect(report.sections).toHaveProperty('incidentResponse');
    expect(report.controlsPackage).toBeDefined();
  });

  it('report includes access control evidence with role breakdown', async () => {
    const report = await service.generateSOC2Evidence();
    const ac = report.sections.accessControl;
    expect(ac.totalUsers).toBe(10);
    expect(ac.roleBreakdown).toHaveProperty('OWNER');
    expect(ac.mfaStatus.enforced).toBe(true);
  });

  it('report includes availability evidence', async () => {
    const report = await service.generateSOC2Evidence();
    const avail = report.sections.availability;
    expect(avail.healthEndpoint).toBe('/health');
    expect(avail.autoRestart).toBe(true);
  });

  it('report includes data encryption evidence', async () => {
    const report = await service.generateSOC2Evidence();
    const enc = report.sections.dataEncryption;
    expect(enc.algorithm).toBe('AES-256-GCM');
  });

  it('report includes audit trail evidence', async () => {
    const report = await service.generateSOC2Evidence();
    const at = report.sections.auditTrail;
    expect(at.totalEntries).toBe(100);
    expect(at.distinctActions).toContain('login');
  });

  it('report has valid reporting period', async () => {
    const report = await service.generateSOC2Evidence();
    const start = new Date(report.reportingPeriod.start);
    const end = new Date(report.reportingPeriod.end);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
