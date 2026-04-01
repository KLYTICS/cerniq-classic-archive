import { OutreachExecutionService } from './outreach-execution.service';

describe('OutreachExecutionService', () => {
  let service: OutreachExecutionService;
  const mockPrisma = {
    prospectInstitution: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const mockEmail = {
    sendRawEmail: jest.fn(),
  } as any;
  const mockLeads = {
    generateOutreach: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OutreachExecutionService(mockPrisma, mockEmail, mockLeads);
    mockPrisma.prospectInstitution.update.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeOutreach', () => {
    it('returns error when prospect not found', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue(null);
      const result = await service.executeOutreach('bad-id');
      expect(result.sent).toBe(false);
      expect(result.error).toBe('Prospect not found');
    });

    it('returns error when prospect has no email', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Test Coop',
        contactEmail: null,
      });
      const result = await service.executeOutreach('p1');
      expect(result.sent).toBe(false);
      expect(result.error).toBe('No contact email for prospect');
    });

    it('sends outreach email successfully', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Coop Test',
        contactEmail: 'cfo@coop.pr',
      });
      mockLeads.generateOutreach.mockResolvedValue({
        subject: 'ALM Analysis for Coop Test',
        body: 'Hello, we have insights...',
      });
      mockEmail.sendRawEmail.mockResolvedValue({});

      const result = await service.executeOutreach('p1', 'es');

      expect(result.sent).toBe(true);
      expect(mockEmail.sendRawEmail).toHaveBeenCalledWith({
        to: 'cfo@coop.pr',
        subject: 'ALM Analysis for Coop Test',
        html: expect.any(String),
      });
      expect(mockPrisma.prospectInstitution.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { outreachStatus: 'sent' },
      });
    });

    it('returns error when email sending fails', async () => {
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Coop',
        contactEmail: 'test@coop.pr',
      });
      mockLeads.generateOutreach.mockResolvedValue({
        subject: 'Test',
        body: 'Body',
      });
      mockEmail.sendRawEmail.mockRejectedValue(new Error('Rate limited'));

      const result = await service.executeOutreach('p1');

      expect(result.sent).toBe(false);
      expect(result.error).toBe('Rate limited');
    });
  });

  describe('executeBulkOutreach', () => {
    it('sends outreach to uncontacted prospects ordered by assets', async () => {
      mockPrisma.prospectInstitution.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Big Coop',
          contactEmail: 'a@b.com',
          estimatedAssets: 500,
        },
      ]);
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Big Coop',
        contactEmail: 'a@b.com',
      });
      mockLeads.generateOutreach.mockResolvedValue({
        subject: 'Test',
        body: 'Body',
      });
      mockEmail.sendRawEmail.mockResolvedValue({});

      const result = await service.executeBulkOutreach('es', 1);

      expect(result.total).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    }, 10000);

    it('returns zeros when no prospects to contact', async () => {
      mockPrisma.prospectInstitution.findMany.mockResolvedValue([]);
      const result = await service.executeBulkOutreach();
      expect(result.total).toBe(0);
      expect(result.sent).toBe(0);
    });

    it('counts failed outreach when executeOutreach returns sent=false', async () => {
      mockPrisma.prospectInstitution.findMany.mockResolvedValue([
        { id: 'p-fail', name: 'Failing Coop', contactEmail: null, estimatedAssets: 100 },
      ]);
      // executeOutreach will return { sent: false } because no contactEmail
      mockPrisma.prospectInstitution.findUnique.mockResolvedValue({
        id: 'p-fail',
        name: 'Failing Coop',
        contactEmail: null,
      });

      const result = await service.executeBulkOutreach('en', 1);
      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
    }, 10000);
  });
});
