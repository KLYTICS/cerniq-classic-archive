import { AlmAdvisorV2Service } from './alm-advisor-v2.service';

describe('AlmAdvisorV2Service', () => {
  let service: AlmAdvisorV2Service;
  const mockPrisma = {} as any;
  const mockAlmEnterprise = {
    getALMSummary: jest.fn(),
  } as any;
  const mockComplianceCalendar = {
    getUpcomingDeadlines: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlmAdvisorV2Service(
      mockPrisma,
      mockAlmEnterprise,
      mockComplianceCalendar,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computeHealthScore returns demo score when enterprise throws', async () => {
    mockAlmEnterprise.getALMSummary.mockRejectedValue(new Error('fail'));
    const result = await service.computeHealthScore('inst-1');
    expect(result.overall).toBe(72);
    expect(result.label).toBe('SATISFACTORY');
    expect(result.capital).toBe(16);
    expect(result.liquidity).toBe(16);
  });

  it('computeHealthScore calculates from summary data', async () => {
    mockAlmEnterprise.getALMSummary.mockResolvedValue({
      riskScore: 30,
      liquidity: { lcr: 135 },
      durationGap: { durationGap: 1.5 },
    });
    const result = await service.computeHealthScore('inst-1');
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect([
      'STRONG',
      'SATISFACTORY',
      'FAIR',
      'MARGINAL',
      'UNSATISFACTORY',
    ]).toContain(result.label);
  });

  it('rankAlerts returns top 3 alerts sorted by lowest score', () => {
    const health = {
      overall: 50,
      capital: 4,
      liquidity: 16,
      rateRisk: 8,
      credit: 12,
      concentration: 14,
      label: 'FAIR' as const,
    };
    const alerts = service.rankAlerts(health);
    expect(alerts).toHaveLength(3);
    expect(alerts[0].rank).toBe(1);
    expect(alerts[0].domain).toBe('Capital Adequacy');
    expect(alerts[0].severity).toBe('HIGH');
    expect(alerts[1].rank).toBe(2);
  });

  it('rankAlerts assigns severity based on threshold', () => {
    const health = {
      overall: 80,
      capital: 16,
      liquidity: 16,
      rateRisk: 16,
      credit: 16,
      concentration: 16,
      label: 'STRONG' as const,
    };
    const alerts = service.rankAlerts(health);
    expect(alerts).toHaveLength(3);
    alerts.forEach((a) => {
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(a.severity);
    });
  });

  it('buildRegPulse returns default messages when calendar throws', async () => {
    mockComplianceCalendar.getUpcomingDeadlines.mockRejectedValue(
      new Error('fail'),
    );
    const pulse = await service.buildRegPulse('inst-1');
    expect(pulse.next30).toBe('No deadlines in this period.');
    expect(pulse.next30Es).toBe(
      'Sin fechas límite pendientes en este período.',
    );
    expect(pulse.criticalDeadlines).toEqual([]);
  });

  it('buildRegPulse categorizes events into 30/60/90 day windows', async () => {
    const now = Date.now();
    mockComplianceCalendar.getUpcomingDeadlines.mockResolvedValue({
      events: [
        {
          title: 'Filing A',
          deadlineDate: new Date(now + 10 * 86400000).toISOString(),
          urgency: 'CRITICAL',
        },
        {
          title: 'Filing B',
          deadlineDate: new Date(now + 45 * 86400000).toISOString(),
          urgency: 'HIGH',
        },
        {
          title: 'Filing C',
          deadlineDate: new Date(now + 75 * 86400000).toISOString(),
          urgency: 'MEDIUM',
        },
      ],
    });
    const pulse = await service.buildRegPulse('inst-1');
    expect(pulse.next30).toContain('Filing A');
    expect(pulse.next60).toContain('Filing B');
    expect(pulse.next90).toContain('Filing C');
    expect(pulse.criticalDeadlines).toContain('Filing A');
  });

  // ── Additional coverage: scoring sub-functions, labels, narrative ──

  describe('computeHealthScore labels', () => {
    it('assigns STRONG for score >= 80', async () => {
      mockAlmEnterprise.getALMSummary.mockResolvedValue({
        riskScore: 10,
        liquidity: { lcr: 140 },
        durationGap: { durationGap: 0.5 },
      });
      const result = await service.computeHealthScore('inst-1');
      expect(result.label).toBe('STRONG');
    });

    it('assigns UNSATISFACTORY for very low scores', async () => {
      mockAlmEnterprise.getALMSummary.mockResolvedValue({
        riskScore: 95,
        liquidity: { lcr: 50 },
        durationGap: { durationGap: 6.0 },
      });
      const result = await service.computeHealthScore('inst-1');
      expect(result.overall).toBeLessThan(40);
    });

    it('assigns FAIR for score 40-59', async () => {
      mockAlmEnterprise.getALMSummary.mockResolvedValue({
        riskScore: 60,
        liquidity: { lcr: 95 },
        durationGap: { durationGap: 3.5 },
      });
      const result = await service.computeHealthScore('inst-1');
      expect(['FAIR', 'MARGINAL']).toContain(result.label);
    });
  });

  describe('rankAlerts detail', () => {
    it('includes regulatoryRef for each alert', () => {
      const health = {
        overall: 50,
        capital: 8,
        liquidity: 8,
        rateRisk: 8,
        credit: 12,
        concentration: 14,
        label: 'FAIR' as const,
      };
      const alerts = service.rankAlerts(health);
      alerts.forEach((a) => {
        expect(a.regulatoryRef).toBeDefined();
        expect(a.regulatoryRef.length).toBeGreaterThan(0);
      });
    });

    it('assigns MEDIUM severity for mid-range scores', () => {
      const health = {
        overall: 60,
        capital: 10,
        liquidity: 10,
        rateRisk: 10,
        credit: 16,
        concentration: 14,
        label: 'SATISFACTORY' as const,
      };
      const alerts = service.rankAlerts(health);
      const mediumAlerts = alerts.filter((a) => a.severity === 'MEDIUM');
      expect(mediumAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('getStaticNarrative', () => {
    beforeEach(() => {
      mockAlmEnterprise.getALMSummary.mockResolvedValue({
        riskScore: 40,
        liquidity: { lcr: 120 },
        durationGap: { durationGap: 1.5 },
      });
      mockComplianceCalendar.getUpcomingDeadlines.mockResolvedValue({ events: [] });
    });

    it('returns a narrative containing health score section', async () => {
      const result = await service.getStaticNarrative('inst-1', 'en');
      expect(result.narrative).toContain('Health Score');
      expect(result.healthScore).toBeDefined();
    });

    it('returns a Spanish narrative', async () => {
      const result = await service.getStaticNarrative('inst-1', 'es');
      expect(result.narrative).toContain('Puntuaci');
      expect(result.narrative).toContain('Alertas');
    });

    it('includes alerts in narrative', async () => {
      const result = await service.getStaticNarrative('inst-1', 'en');
      expect(result.narrative).toContain('Risk Alerts');
      expect(result.alerts).toHaveLength(3);
    });

    it('includes regulatory pulse in narrative', async () => {
      const result = await service.getStaticNarrative('inst-1', 'en');
      expect(result.narrative).toContain('Regulatory Pulse');
      expect(result.pulse).toBeDefined();
    });
  });
});
