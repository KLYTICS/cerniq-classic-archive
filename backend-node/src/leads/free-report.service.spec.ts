import { FreeReportService } from './free-report.service';
import { FreeReportController } from './free-report.controller';

// ─── Mock PrismaService ──────────────────────────────────────

const mockPrisma = {
  lead: {
    create: jest.fn(),
  },
  prospectInstitution: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as any;

const mockPdfService = {
  generateFreeReportPdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
} as any;

const mockEmailService = {
  sendFreeReportEmail: jest.fn().mockResolvedValue(undefined),
} as any;

// ─── Service Tests ───────────────────────────────────────────

describe('FreeReportService', () => {
  let service: FreeReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FreeReportService(
      mockPrisma,
      mockPdfService,
      mockEmailService,
    );

    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-test-001' });
    mockPrisma.prospectInstitution.findFirst.mockResolvedValue(null);
    mockPrisma.prospectInstitution.create.mockResolvedValue({
      id: 'prospect-test-001',
    });
  });

  // ── Fuzzy Matching ────────────────────────────────────────

  describe('fuzzyMatch', () => {
    it('finds "Cooperativa Caguas" when input is "Caguas"', () => {
      const result = service.fuzzyMatch('Caguas');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('caguas');
      expect(result!.name).toContain('Caguas');
    });

    it('finds Caguas with full formal name', () => {
      const result = service.fuzzyMatch(
        'Cooperativa de Ahorro y Crédito de Caguas',
      );
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('caguas');
    });

    it('finds Oriental with partial name', () => {
      const result = service.fuzzyMatch('Cooperativa Oriental');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('oriental');
    });

    it('finds COOPACA with just "COOPACA"', () => {
      const result = service.fuzzyMatch('COOPACA');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('coopaca');
    });

    it('finds Rincón ignoring diacritics', () => {
      const result = service.fuzzyMatch('Rincón');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('rincon');
    });

    it('finds Rincon without diacritics', () => {
      const result = service.fuzzyMatch('rincon');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('rincon');
    });

    it('finds La Sagrada Familia', () => {
      const result = service.fuzzyMatch('Sagrada Familia');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('sagrada-familia');
    });

    it('returns null for completely unknown institution', () => {
      const result = service.fuzzyMatch('First National Bank of Mars');
      expect(result).toBeNull();
    });

    it('is case-insensitive', () => {
      const result = service.fuzzyMatch('CAGUAS');
      expect(result).not.toBeNull();
      expect(result!.slug).toBe('caguas');
    });
  });

  // ── NII Hook Computation ──────────────────────────────────

  describe('NII hook computation', () => {
    it('computes correct NII hook for Caguas Coop (~$136.6M Anejo 9)', async () => {
      const result = await service.generateFreeReport({
        institutionName: 'Caguas',
        email: 'cfo@caguas.coop',
        firstName: 'Maria',
      });

      expect(result.niiHookDollars).toBeCloseTo(
        136_620_545.3 * 0.6 * 0.0001,
        0,
      );
      expect(result.matched).toBe(true);
      expect(result.slug).toBe('caguas');
    });

    it('computes correct NII hook for Oriental (~$440.8M Anejo 9)', async () => {
      const result = await service.generateFreeReport({
        institutionName: 'Oriental',
        email: 'cfo@oriental.coop',
        firstName: 'José',
      });

      expect(result.niiHookDollars).toBeCloseTo(
        440_798_120.12 * 0.6 * 0.0001,
        0,
      );
    });

    it('computes NII hook for Roosevelt Roads (~$246.6M Anejo 9)', async () => {
      const result = await service.generateFreeReport({
        institutionName: 'Roosevelt Roads',
        email: 'cfo@rr.coop',
        firstName: 'Carlos',
      });

      expect(result.niiHookDollars).toBeCloseTo(
        246_562_455.86 * 0.6 * 0.0001,
        0,
      );
      expect(result.matched).toBe(true);
    });
  });

  // ── Unknown Institution Fallback ──────────────────────────

  describe('unknown institution fallback', () => {
    it('uses sector averages when institution is not matched', async () => {
      const result = await service.generateFreeReport({
        institutionName: 'Some Unknown Credit Union',
        email: 'cfo@unknown.coop',
        firstName: 'Pedro',
      });

      expect(result.matched).toBe(false);
      expect(result.slug).toBeNull();
      expect(result.city).toBeNull();

      // Should use sector median assets: 185_000_000
      // 185_000_000 * 0.60 * 0.0001 = 11_100
      expect(result.totalAssets).toBe(185_000_000);
      expect(result.niiHookDollars).toBe(11_100);
      expect(result.disclosure).toContain('sector averages');
    });

    it('still creates a Lead record for unknown institutions', async () => {
      await service.generateFreeReport({
        institutionName: 'Cooperativa Inventada',
        email: 'test@example.com',
        firstName: 'Test',
      });

      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.lead.create.mock.calls[0][0];
      expect(createCall.data.source).toBe('free_report');
      expect(createCall.data.priority).toBe('HIGH');
    });

    it('does not create ProspectInstitution for unknown institutions', async () => {
      await service.generateFreeReport({
        institutionName: 'Cooperativa Inventada',
        email: 'test@example.com',
        firstName: 'Test',
      });

      expect(mockPrisma.prospectInstitution.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.prospectInstitution.create).not.toHaveBeenCalled();
    });
  });

  // ── Health Score ──────────────────────────────────────────

  describe('computeHealthScore', () => {
    it('returns high score for strong metrics', () => {
      const score = service.computeHealthScore({
        capitalRatioPct: 11.0,
        liquidityRatioPct: 25.0,
        niiMarginPct: 4.2,
        assetGrowthYoyPct: 5.5,
        loanToDepositPct: 74.0,
      });
      expect(score).toBeGreaterThanOrEqual(70);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('returns low score for weak metrics', () => {
      const score = service.computeHealthScore({
        capitalRatioPct: 7.2,
        liquidityRatioPct: 15.5,
        niiMarginPct: 2.6,
        assetGrowthYoyPct: 0.5,
        loanToDepositPct: 42.0,
      });
      expect(score).toBeLessThan(30);
    });

    it('returns score between 0 and 100', () => {
      const score = service.computeHealthScore({
        capitalRatioPct: 9.2,
        liquidityRatioPct: 22.1,
        niiMarginPct: 3.8,
        assetGrowthYoyPct: 4.2,
        loanToDepositPct: 72.5,
      });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ── Lead + Prospect Creation ──────────────────────────────

  describe('database records', () => {
    it('creates Lead with correct source and priority', async () => {
      await service.generateFreeReport({
        institutionName: 'Caguas',
        email: 'cfo@caguas.coop',
        firstName: 'Maria',
      });

      expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
      const data = mockPrisma.lead.create.mock.calls[0][0].data;
      expect(data.source).toBe('free_report');
      expect(data.priority).toBe('HIGH');
      expect(data.institutionType).toBe('cooperativa');
      expect(data.email).toBe('cfo@caguas.coop');
    });

    it('creates ProspectInstitution when matched and none exists', async () => {
      mockPrisma.prospectInstitution.findFirst.mockResolvedValue(null);

      const result = await service.generateFreeReport({
        institutionName: 'Caguas',
        email: 'cfo@caguas.coop',
        firstName: 'Maria',
      });

      expect(mockPrisma.prospectInstitution.create).toHaveBeenCalledTimes(1);
      const data = mockPrisma.prospectInstitution.create.mock.calls[0][0].data;
      expect(data.publicDataIdentifier).toBe('caguas');
      expect(data.contactEmail).toBe('cfo@caguas.coop');
      expect(data.outreachStatus).toBe('sample_generated');
      expect(result.prospectInstitutionId).toBe('prospect-test-001');
    });

    it('uses existing ProspectInstitution when found', async () => {
      mockPrisma.prospectInstitution.findFirst.mockResolvedValue({
        id: 'existing-prospect',
        contactEmail: 'already@set.com',
      });

      const result = await service.generateFreeReport({
        institutionName: 'Caguas',
        email: 'new@caguas.coop',
        firstName: 'Maria',
      });

      expect(mockPrisma.prospectInstitution.create).not.toHaveBeenCalled();
      expect(result.prospectInstitutionId).toBe('existing-prospect');
    });
  });
});

// ─── Controller Rate Limiting Tests ──────────────────────────

describe('FreeReportController — rate limiting', () => {
  let controller: FreeReportController;
  const mockService = {
    generateFreeReport: jest.fn().mockResolvedValue({
      matched: true,
      healthScore: 78,
      healthGrade: 'B',
      niiHookFormatted: '$168K',
    }),
  } as any;

  const mockControllerPrisma = {
    lead: { update: jest.fn() },
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as any;

  const mockReq = {
    headers: { 'x-forwarded-for': '192.168.1.100' },
    ip: '192.168.1.100',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FreeReportController(mockService, mockControllerPrisma);
  });

  it('allows first 3 requests from same IP', async () => {
    const body = {
      institutionName: 'Caguas',
      email: 'test@example.com',
      firstName: 'Test',
    };

    // Requests 1-3 should succeed
    for (let i = 0; i < 3; i++) {
      const result = await controller.requestFreeReport(body, mockReq);
      expect(result.success).toBe(true);
    }
  });

  it('blocks 4th request from same IP', async () => {
    const body = {
      institutionName: 'Caguas',
      email: 'test@example.com',
      firstName: 'Test',
    };

    // Exhaust 3 tokens
    for (let i = 0; i < 3; i++) {
      await controller.requestFreeReport(body, mockReq);
    }

    // 4th request should be rate-limited
    await expect(controller.requestFreeReport(body, mockReq)).rejects.toThrow();
  });

  it('allows requests from different IPs independently', async () => {
    const body = {
      institutionName: 'Caguas',
      email: 'test@example.com',
      firstName: 'Test',
    };

    // Exhaust tokens for IP A
    for (let i = 0; i < 3; i++) {
      await controller.requestFreeReport(body, mockReq);
    }

    // IP B should still work
    const reqB = { headers: { 'x-forwarded-for': '10.0.0.1' }, ip: '10.0.0.1' };
    const result = await controller.requestFreeReport(body, reqB);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', async () => {
    const body = {
      institutionName: 'Caguas',
      email: 'not-an-email',
      firstName: 'Test',
    };

    await expect(controller.requestFreeReport(body, mockReq)).rejects.toThrow(
      'A valid email address is required.',
    );
  });

  it('rejects missing institutionName', async () => {
    const body = {
      institutionName: '',
      email: 'test@example.com',
      firstName: 'Test',
    };

    await expect(controller.requestFreeReport(body, mockReq)).rejects.toThrow(
      'institutionName is required.',
    );
  });

  it('rejects missing firstName', async () => {
    const body = {
      institutionName: 'Caguas',
      email: 'test@example.com',
      firstName: '',
    };

    await expect(controller.requestFreeReport(body, mockReq)).rejects.toThrow(
      'firstName is required.',
    );
  });
});
