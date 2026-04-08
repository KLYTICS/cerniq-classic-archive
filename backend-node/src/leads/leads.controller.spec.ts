// @ts-nocheck — Mock data uses simplified shapes
import { LeadsController } from './leads.controller';

function mockSvc(): any {
  return new Proxy({}, {
    get: (_t: any, p: any) => typeof p === 'symbol' ? undefined : jest.fn().mockResolvedValue(null),
  });
}

describe('LeadsController', () => {
  let controller: LeadsController;
  let leads: Record<string, jest.Mock>;
  let qualification: Record<string, jest.Mock>;
  let scoring: Record<string, jest.Mock>;
  let outreach: Record<string, jest.Mock>;

  beforeEach(() => {
    leads = {
      submitLead: jest.fn().mockResolvedValue({ id: 'lead-1', status: 'new' }),
      listLeads: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getLead: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      updateLead: jest.fn().mockResolvedValue({ id: 'lead-1' }),
      addNote: jest.fn().mockResolvedValue({ success: true }),
      markReportSent: jest.fn().mockResolvedValue({ success: true }),
      getPipelineMetrics: jest.fn().mockResolvedValue({ total: 5, conversion: '20%' }),
      seedProspectPipeline: jest.fn().mockResolvedValue({ seeded: 12 }),
      getProspects: jest.fn().mockResolvedValue([]),
      getBenchmarks: jest.fn().mockResolvedValue([]),
      generateOutreach: jest.fn().mockResolvedValue({ subject: 'Test', body: 'Body' }),
    };
    qualification = {
      qualifyProspect: jest.fn().mockResolvedValue({ score: 85, tier: 'A' }),
      qualifyAllProspects: jest.fn().mockResolvedValue([]),
    };
    scoring = {
      scoreLead: jest.fn().mockResolvedValue({ score: 72 }),
      scoreAllLeads: jest.fn().mockResolvedValue([]),
    };
    outreach = {
      executeOutreach: jest.fn().mockResolvedValue({ sent: true }),
      executeBulkOutreach: jest.fn().mockResolvedValue({ sent: 5, failed: 0 }),
    };

    const intelligence = mockSvc();
    const demoSeats = mockSvc();
    const demoSeatAnalytics = mockSvc();
    controller = new LeadsController(
      leads as any,
      qualification as any,
      scoring as any,
      outreach as any,
      intelligence as any,
      demoSeats as any,
      demoSeatAnalytics as any,
    );
  });

  describe('POST /api/v1/leads/submit', () => {
    it('submits a lead', async () => {
      const dto = { email: 'cfo@coop.pr', institutionName: 'CoopAhorro', institutionType: 'cooperativa' };
      const r = await controller.submitLead(dto as any);
      expect(leads.submitLead).toHaveBeenCalledWith(dto);
      expect(r.id).toBe('lead-1');
    });
  });

  describe('GET admin/api/leads', () => {
    it('lists leads', async () => {
      const r = await controller.listLeads({} as any);
      expect(r.total).toBe(0);
    });
  });

  describe('GET admin/api/leads/metrics', () => {
    it('returns pipeline metrics', async () => {
      const r = await controller.getMetrics();
      expect(r.total).toBe(5);
    });
  });

  describe('GET admin/api/leads/:id', () => {
    it('returns lead by ID', async () => {
      const r = await controller.getLead('lead-1');
      expect(leads.getLead).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('PUT admin/api/leads/:id', () => {
    it('updates lead', async () => {
      const r = await controller.updateLead('lead-1', { status: 'CONTACTED' } as any);
      expect(leads.updateLead).toHaveBeenCalledWith('lead-1', { status: 'CONTACTED' });
    });
  });

  describe('POST admin/api/leads/:id/note', () => {
    it('adds note to lead', async () => {
      const r = await controller.addNote('lead-1', 'Called CFO');
      expect(leads.addNote).toHaveBeenCalledWith('lead-1', 'Called CFO');
    });
  });

  describe('POST admin/api/prospects/seed', () => {
    it('seeds prospect pipeline', async () => {
      const r = await controller.seedProspects();
      expect(leads.seedProspectPipeline).toHaveBeenCalled();
    });
  });

  describe('GET admin/api/prospects/:id/qualify', () => {
    it('qualifies a prospect', async () => {
      const r = await controller.qualifyProspect('p-1');
      expect(qualification.qualifyProspect).toHaveBeenCalledWith('p-1');
    });
  });

  describe('GET admin/api/leads/:id/score', () => {
    it('scores a lead', async () => {
      const r = await controller.scoreLead('lead-1');
      expect(scoring.scoreLead).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('POST admin/api/prospects/:id/send-outreach', () => {
    it('sends outreach to prospect', async () => {
      const r = await controller.sendOutreach('p-1', 'es');
      expect(outreach.executeOutreach).toHaveBeenCalled();
    });

    it('defaults to es when lang is not en', async () => {
      await controller.sendOutreach('p-1', 'fr');
      expect(outreach.executeOutreach).toHaveBeenCalledWith('p-1', 'es');
    });

    it('uses en when lang is en', async () => {
      await controller.sendOutreach('p-1', 'en');
      expect(outreach.executeOutreach).toHaveBeenCalledWith('p-1', 'en');
    });
  });

  describe('POST admin/api/leads/:id/mark-report-sent', () => {
    it('marks report as sent', async () => {
      await controller.markReportSent('lead-1');
      expect(leads.markReportSent).toHaveBeenCalledWith('lead-1');
    });
  });

  describe('GET admin/api/prospects', () => {
    it('lists prospects', async () => {
      leads.listProspects = jest.fn().mockResolvedValue([{ id: 'p-1' }]);
      const r = await controller.listProspects();
      expect(leads.listProspects).toHaveBeenCalled();
    });
  });

  describe('GET admin/api/benchmarks', () => {
    it('returns benchmarks', async () => {
      leads.getBenchmarks = jest.fn().mockResolvedValue({ nim: 3.5 });
      const r = await controller.getBenchmarks();
      expect(leads.getBenchmarks).toHaveBeenCalled();
    });
  });

  describe('GET admin/api/prospects/:id/outreach', () => {
    it('generates outreach in default es language', async () => {
      leads.generateOutreach = jest.fn().mockResolvedValue({ subject: 'Test' });
      await controller.generateOutreach('p-1');
      expect(leads.generateOutreach).toHaveBeenCalledWith('p-1', 'es');
    });

    it('generates outreach in en language', async () => {
      leads.generateOutreach = jest.fn().mockResolvedValue({ subject: 'Test' });
      await controller.generateOutreach('p-1', 'en');
      expect(leads.generateOutreach).toHaveBeenCalledWith('p-1', 'en');
    });
  });

  describe('GET admin/api/prospects/qualify/all', () => {
    it('qualifies all prospects', async () => {
      await controller.qualifyAllProspects();
      expect(qualification.qualifyAllProspects).toHaveBeenCalled();
    });
  });

  describe('POST admin/api/leads/score-all', () => {
    it('scores all leads', async () => {
      await controller.scoreAllLeads();
      expect(scoring.scoreAllLeads).toHaveBeenCalled();
    });
  });

  describe('POST admin/api/prospects/bulk-outreach', () => {
    it('executes bulk outreach with defaults', async () => {
      await controller.bulkOutreach();
      expect(outreach.executeBulkOutreach).toHaveBeenCalledWith('es', 10);
    });

    it('executes bulk outreach with en and custom limit', async () => {
      await controller.bulkOutreach('en', '25');
      expect(outreach.executeBulkOutreach).toHaveBeenCalledWith('en', 25);
    });
  });

  describe('POST api/demo/track', () => {
    it('tracks demo step and returns tracked: true', async () => {
      const req = { headers: { 'x-request-id': 'sess-123' } };
      const result = await controller.trackDemoStep(
        { step: 3, timestamp: '2026-01-01T00:00:00Z' },
        req,
      );
      expect(result).toEqual({ tracked: true });
    });

    it('logs demo.completed when step is 6', async () => {
      const req = { headers: {} };
      const result = await controller.trackDemoStep(
        { step: 6, timestamp: '2026-01-01T00:00:00Z' },
        req,
      );
      expect(result).toEqual({ tracked: true });
    });
  });

  describe('GET admin/api/leads with filters', () => {
    it('passes status and priority filters', async () => {
      await controller.listLeads('NEW', 'HIGH');
      expect(leads.listLeads).toHaveBeenCalledWith({
        status: 'NEW',
        priority: 'HIGH',
      });
    });
  });
});
