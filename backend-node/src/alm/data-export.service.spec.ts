import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DataExportService } from './data-export.service';

describe('Data Export Service', () => {
  const latestRun = {
    id: 'run-1',
    createdAt: new Date('2026-03-29T15:30:00.000Z'),
    resultSummary: {
      summary: {
        riskScore: 58,
        durationGap: {
          durationGap: 1.8,
          riskProfile: 'Moderate',
          assetDuration: 3.6,
          liabilityDuration: 1.8,
        },
        liquidity: { lcr: 92, status: 'WATCH' },
        niiSensitivity: { baseNII: 48.2, riskRating: 'high' },
        fullAnalysis: {
          summary: {
            totalAssets: 1200,
            totalLiabilities: 1080,
            equity: 120,
          },
          eve: { baseEVE: 110.4 },
          bpv: { netBPV: -2.75 },
        },
      },
    },
    institution: {
      id: 'inst-1',
      name: 'CerniQ "Alpha", Corp',
      reportingDate: new Date('2026-03-29T00:00:00.000Z'),
    },
  };

  it('exports derived JSON metrics for the latest completed run', async () => {
    const prisma: any = {
      analysisRun: {
        findFirst: jest.fn().mockResolvedValue(latestRun),
      },
    };

    const service = new DataExportService(prisma as any);
    const result = await service.exportMetrics('inst-1', 'json');

    expect(prisma.analysisRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { institutionId: 'inst-1', status: 'COMPLETED' },
      }),
    );
    expect(result).toEqual({
      institutionId: 'inst-1',
      institutionName: 'CerniQ "Alpha", Corp',
      reportDate: '2026-03-29T15:30:00.000Z',
      riskScore: 58,
      capitalRatio: 10,
      lcr: 92,
      lcrStatus: 'WATCH',
      durationGap: 1.8,
      durationGapRiskProfile: 'Moderate',
      assetDuration: 3.6,
      liabilityDuration: 1.8,
      baseNII: 48.2,
      niiRiskRating: 'high',
      baseEVE: 110.4,
      totalAssets: 1200,
      totalLiabilities: 1080,
      equity: 120,
      netBPV: -2.75,
    });
  });

  it('exports escaped CSV for operator handoff', async () => {
    const prisma: any = {
      analysisRun: {
        findFirst: jest.fn().mockResolvedValue(latestRun),
      },
    };

    const service = new DataExportService(prisma as any);
    const result = await service.exportMetrics('inst-1', 'csv');

    expect(typeof result).toBe('string');
    expect(result).toContain('institutionId,institutionName,reportDate');
    expect(result).toContain('"CerniQ ""Alpha"", Corp"');
    expect(result).toContain('WATCH');
  });

  it('fails clearly when no completed run exists', async () => {
    const prisma: any = {
      analysisRun: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new DataExportService(prisma as any);

    await expect(service.exportMetrics('missing-inst', 'json')).rejects.toThrow(
      NotFoundException,
    );
  });
});
