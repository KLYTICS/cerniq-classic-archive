import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CpaClientService } from './cpa-client.service';
import { CpaFirmService } from './cpa-firm.service';

describe('CpaClientService', () => {
  let service: CpaClientService;
  let prisma: any;
  let firmService: any;

  const baseFirm = {
    id: 'firm-1',
    name: 'Torres & Asociados CPA',
    slug: 'torres-cpa',
    tier: 'CPA_STANDARD',
    isActive: true,
  };

  beforeEach(() => {
    prisma = {
      cpaFirm: {
        findUnique: jest.fn().mockResolvedValue(baseFirm),
      },
      institution: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      cpaClientRelationship: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      analysisRun: {
        findFirst: jest.fn(),
      },
    };

    firmService = {
      checkClientLimit: jest.fn(),
    };

    service = new CpaClientService(prisma, firmService);
  });

  // ─── addClient ────────────────────────────────────────────────

  describe('addClient', () => {
    it('creates a new client relationship', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 2,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Cooperativa Caguas',
      });
      // No existing relationship
      prisma.cpaClientRelationship.findFirst
        .mockResolvedValueOnce(null) // active check
        .mockResolvedValueOnce(null); // removed check
      prisma.cpaClientRelationship.create.mockResolvedValue({
        id: 'rel-1',
        firmId: 'firm-1',
        institutionId: 'inst-1',
        brandingOverride: {},
        addedAt: new Date(),
        removedAt: null,
      });

      const result = await service.addClient('firm-1', 'inst-1');

      expect(result.id).toBe('rel-1');
      expect(prisma.cpaClientRelationship.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cpaFirmId: 'firm-1',
            institutionId: 'inst-1',
          }),
        }),
      );
    });

    it('throws ForbiddenException when client limit is reached', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 5,
        max: 5,
        canAdd: false,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Cooperativa Caguas',
      });

      await expect(service.addClient('firm-1', 'inst-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when firm does not exist', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      await expect(service.addClient('missing', 'inst-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when institution does not exist', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 0,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue(null);

      await expect(service.addClient('firm-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when institution is already a client', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 2,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Cooperativa Caguas',
      });
      prisma.cpaClientRelationship.findFirst.mockResolvedValue({
        id: 'rel-existing',
        firmId: 'firm-1',
        institutionId: 'inst-1',
        removedAt: null,
      });

      await expect(service.addClient('firm-1', 'inst-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('reactivates a previously removed relationship', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 2,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Cooperativa Caguas',
      });
      prisma.cpaClientRelationship.findFirst
        .mockResolvedValueOnce(null) // no active
        .mockResolvedValueOnce({
          // previously removed
          id: 'rel-old',
          firmId: 'firm-1',
          institutionId: 'inst-1',
          removedAt: new Date('2026-01-01'),
          brandingOverride: {},
        });
      prisma.cpaClientRelationship.update.mockResolvedValue({
        id: 'rel-old',
        removedAt: null,
      });

      const result = await service.addClient('firm-1', 'inst-1');

      expect(result.removedAt).toBeNull();
      expect(prisma.cpaClientRelationship.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rel-old' },
          data: expect.objectContaining({ removedAt: null }),
        }),
      );
    });
  });

  // ─── removeClient ─────────────────────────────────────────────

  describe('removeClient', () => {
    it('soft-removes client by setting removedAt', async () => {
      prisma.cpaClientRelationship.findFirst.mockResolvedValue({
        id: 'rel-1',
        firmId: 'firm-1',
        institutionId: 'inst-1',
        removedAt: null,
      });
      prisma.cpaClientRelationship.update.mockResolvedValue({
        id: 'rel-1',
        removedAt: new Date(),
      });

      await service.removeClient('firm-1', 'inst-1');

      expect(prisma.cpaClientRelationship.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rel-1' },
          data: expect.objectContaining({
            removedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws NotFoundException when no active relationship exists', async () => {
      prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);

      await expect(
        service.removeClient('firm-1', 'inst-missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getClientDashboard ───────────────────────────────────────

  describe('getClientDashboard', () => {
    it('aggregates risk distribution across clients', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaClientRelationship.findMany.mockResolvedValue([
        {
          institutionId: 'inst-1',
          institution: {
            id: 'inst-1',
            name: 'Coop A',
            type: 'cooperativa',
            totalAssets: Number(2800),
            reportingDate: new Date(),
          },
        },
        {
          institutionId: 'inst-2',
          institution: {
            id: 'inst-2',
            name: 'Coop B',
            type: 'cooperativa',
            totalAssets: Number(1500),
            reportingDate: new Date(),
          },
        },
        {
          institutionId: 'inst-3',
          institution: {
            id: 'inst-3',
            name: 'Coop C',
            type: 'cooperativa',
            totalAssets: Number(950),
            reportingDate: new Date(),
          },
        },
      ]);

      // inst-1: high risk (75), inst-2: medium risk (50), inst-3: low risk (20)
      prisma.analysisRun.findFirst
        .mockResolvedValueOnce({
          overallRiskScore: 75,
          createdAt: new Date(),
          regulatoryCompliance: 'non_compliant',
        })
        .mockResolvedValueOnce({
          overallRiskScore: 50,
          createdAt: new Date(),
          regulatoryCompliance: 'compliant',
        })
        .mockResolvedValueOnce({
          overallRiskScore: 20,
          createdAt: new Date(),
          regulatoryCompliance: 'compliant',
        });

      const dashboard = await service.getClientDashboard('firm-1');

      expect(dashboard.firmName).toBe('Torres & Asociados CPA');
      expect(dashboard.totalClients).toBe(3);
      expect(dashboard.totalAssetsUnderAdvisory).toBe('5250');
      expect(dashboard.riskDistribution).toEqual({
        high: 1,
        medium: 1,
        low: 1,
      });
    });

    it('returns zero totals for firm with no clients', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaClientRelationship.findMany.mockResolvedValue([]);

      const dashboard = await service.getClientDashboard('firm-1');

      expect(dashboard.totalClients).toBe(0);
      expect(dashboard.totalAssetsUnderAdvisory).toBe('0');
      expect(dashboard.riskDistribution).toEqual({
        high: 0,
        medium: 0,
        low: 0,
      });
    });

    it('throws NotFoundException for missing firm', async () => {
      prisma.cpaFirm.findUnique.mockResolvedValue(null);

      await expect(service.getClientDashboard('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('emits UNWIRED_INTEGRATION gaps for unwired alert + exam-prep feeds (Rule 1 — no silent empty arrays)', async () => {
      // Locks the convention: until the agent alert pipeline and exam-prep
      // scheduler land, the dashboard MUST return `null` for those fields
      // (not `[]`) AND emit a matching DataGap entry so the UI renders
      // "DATA UNAVAILABLE" instead of "0 alerts" / "0 exams". A regulator
      // reading "0 alerts" on a CPA dashboard would conclude there are no
      // alerts to act on — the actual state is "the alert feed isn't built
      // yet." That misreading is the exact failure mode KLYTICS Rule 1
      // exists to prevent.
      prisma.cpaFirm.findUnique.mockResolvedValue(baseFirm);
      prisma.cpaClientRelationship.findMany.mockResolvedValue([]);

      const dashboard = await service.getClientDashboard('firm-1');

      expect(dashboard.recentAlerts).toBeNull();
      expect(dashboard.upcomingExams).toBeNull();
      expect(dashboard.gaps).toHaveLength(2);

      const fields = dashboard.gaps.map((g) => g.field).sort();
      expect(fields).toEqual([
        'dashboard.recentAlerts',
        'dashboard.upcomingExams',
      ]);
      for (const g of dashboard.gaps) {
        expect(g.reason).toBe('UNWIRED_INTEGRATION');
        expect(g.severity).toBe('WARNING');
        expect(g.action).toBeTruthy();
      }
    });
  });

  // ─── bulkAddClients ───────────────────────────────────────────

  describe('bulkAddClients', () => {
    it('adds multiple clients successfully', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 0,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Coop',
      });
      prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);
      prisma.cpaClientRelationship.create.mockResolvedValue({
        id: 'rel-new',
        removedAt: null,
      });

      const result = await service.bulkAddClients('firm-1', [
        'inst-1',
        'inst-2',
      ]);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('skips duplicates and records them as skipped', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 2,
        max: 5,
        canAdd: true,
      });
      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Coop',
      });

      // First institution: already exists (conflict)
      prisma.cpaClientRelationship.findFirst
        .mockResolvedValueOnce({
          id: 'existing',
          removedAt: null,
        }) // inst-1 active check = exists
        .mockResolvedValueOnce(null) // inst-2 active check = not exists
        .mockResolvedValueOnce(null); // inst-2 removed check = not exists

      prisma.cpaClientRelationship.create.mockResolvedValue({
        id: 'rel-new',
        removedAt: null,
      });

      const result = await service.bulkAddClients('firm-1', [
        'inst-1',
        'inst-2',
      ]);

      expect(result.skipped).toBe(1);
      expect(result.added).toBe(1);
    });

    it('captures errors for institutions that fail for non-conflict reasons', async () => {
      firmService.checkClientLimit.mockResolvedValue({
        current: 0,
        max: 5,
        canAdd: true,
      });
      // First: institution not found
      prisma.institution.findUnique.mockResolvedValueOnce(null);
      // Second: institution exists and succeeds
      prisma.institution.findUnique.mockResolvedValueOnce({
        id: 'inst-2',
        name: 'Coop B',
      });
      prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);
      prisma.cpaClientRelationship.create.mockResolvedValue({
        id: 'rel-new',
        removedAt: null,
      });

      const result = await service.bulkAddClients('firm-1', [
        'inst-missing',
        'inst-2',
      ]);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].institutionId).toBe('inst-missing');
      expect(result.added).toBe(1);
    });

    it('handles limit exceeded mid-bulk', async () => {
      // First call: can add. Second call: limit reached.
      firmService.checkClientLimit
        .mockResolvedValueOnce({ current: 4, max: 5, canAdd: true })
        .mockResolvedValueOnce({ current: 5, max: 5, canAdd: false });

      prisma.institution.findUnique.mockResolvedValue({
        id: 'inst-1',
        name: 'Coop',
      });
      prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);
      prisma.cpaClientRelationship.create.mockResolvedValue({
        id: 'rel-new',
        removedAt: null,
      });

      const result = await service.bulkAddClients('firm-1', [
        'inst-1',
        'inst-2',
      ]);

      // First one succeeds, second hits limit error
      expect(result.added).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('client limit');
    });
  });

  // ─── listClients ──────────────────────────────────────────────

  describe('listClients', () => {
    it('returns clients with latest risk scores', async () => {
      prisma.cpaClientRelationship.findMany.mockResolvedValue([
        {
          institutionId: 'inst-1',
          institution: {
            id: 'inst-1',
            name: 'Cooperativa Caguas',
            type: 'cooperativa',
            totalAssets: Number(2800),
            reportingDate: new Date('2025-09-30'),
          },
        },
      ]);
      prisma.analysisRun.findFirst.mockResolvedValue({
        overallRiskScore: 45,
        createdAt: new Date('2025-10-01'),
        regulatoryCompliance: 'compliant',
      });

      const clients = await service.listClients('firm-1');

      expect(clients).toHaveLength(1);
      expect(clients[0].institution.name).toBe('Cooperativa Caguas');
      expect(clients[0].latestRiskScore).toBe(45);
      expect(clients[0].complianceStatus).toBe('compliant');
    });

    it('returns null risk score when no analysis exists', async () => {
      prisma.cpaClientRelationship.findMany.mockResolvedValue([
        {
          institutionId: 'inst-1',
          institution: {
            id: 'inst-1',
            name: 'Cooperativa Caguas',
            type: 'cooperativa',
            totalAssets: Number(2800),
            reportingDate: null,
          },
        },
      ]);
      prisma.analysisRun.findFirst.mockResolvedValue(null);

      const clients = await service.listClients('firm-1');

      expect(clients[0].latestRiskScore).toBeNull();
      expect(clients[0].latestAnalysisDate).toBeNull();
      expect(clients[0].complianceStatus).toBeNull();
    });
  });
});
