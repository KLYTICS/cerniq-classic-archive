import { describe, expect, it, jest } from '@jest/globals';
import { TrendAnalysisService } from './trend-analysis.service';

describe('Trend Analysis Service', () => {
  it('returns chronological trends with derived metrics', async () => {
    const prisma = {
      analysisRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'run-newer',
            createdAt: new Date('2026-03-29T12:00:00.000Z'),
            resultSummary: {
              summary: {
                riskScore: 49,
                durationGap: { durationGap: 1.4 },
                liquidity: { lcr: 78 },
                niiSensitivity: {
                  scenarios: [{ niImpactPct: -6.2 }, { niImpactPct: -3.1 }],
                },
                fullAnalysis: {
                  summary: { equity: 95, totalAssets: 1000 },
                  eve: { scenarios: [{ changePct: -8.5 }, { changePct: 3.2 }] },
                },
              },
            },
          },
          {
            id: 'run-older',
            createdAt: new Date('2026-03-28T12:00:00.000Z'),
            resultSummary: {
              summary: {
                riskScore: 61,
                durationGap: { durationGap: 0.8 },
                liquidity: { lcr: 104 },
                niiSensitivity: {
                  scenarios: [{ niImpactPct: -2.5 }, { niImpactPct: 1.1 }],
                },
                eveSensitivity: [{ changePct: -4.2 }],
                fullAnalysis: {
                  summary: { equity: 120, totalAssets: 1000 },
                },
              },
            },
          },
        ]),
      },
    };

    const service = new TrendAnalysisService(prisma as any);
    const result = await service.getHistoricalTrend('inst-1');

    expect(prisma.analysisRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { institutionId: 'inst-1', status: 'COMPLETED' },
        take: 20,
      }),
    );
    expect(result.periodCount).toBe(2);
    expect(result.periods.map((period) => period.runId)).toEqual([
      'run-older',
      'run-newer',
    ]);
    expect(result.periods[0]).toMatchObject({
      riskScore: 61,
      capitalRatio: 12,
      lcr: 104,
      durationGap: 0.8,
      niiSensitivity: 2.5,
      eveSensitivity: 4.2,
    });
    expect(result.periods[1]).toMatchObject({
      riskScore: 49,
      capitalRatio: 9.5,
      lcr: 78,
      durationGap: 1.4,
      niiSensitivity: 6.2,
      eveSensitivity: 8.5,
    });
  });

  it('respects metric filters and null-safe extraction', async () => {
    const prisma = {
      analysisRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'run-null',
            createdAt: new Date('2026-03-27T12:00:00.000Z'),
            resultSummary: { summary: { riskScore: 72 } },
          },
        ]),
      },
    };

    const service = new TrendAnalysisService(prisma as any);
    const result = await service.getHistoricalTrend('inst-2', [
      'riskScore',
      'capitalRatio',
    ]);

    expect(result.periods[0]).toEqual({
      date: '2026-03-27T12:00:00.000Z',
      runId: 'run-null',
      riskScore: 72,
      capitalRatio: null,
      lcr: null,
      durationGap: null,
      niiSensitivity: null,
      eveSensitivity: null,
    });
  });
});
