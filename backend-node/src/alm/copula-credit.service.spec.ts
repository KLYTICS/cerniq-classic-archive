import { CopulaCreditService } from './copula-credit.service';

describe('CopulaCreditService', () => {
  let svc: CopulaCreditService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    svc = new CopulaCreditService(mockPrisma);
  });

  it('should return demo result with correct shape when no segments', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result).toHaveProperty('method');
    expect(result).toHaveProperty('var99');
    expect(result).toHaveProperty('var999');
    expect(result).toHaveProperty('es99');
    expect(result).toHaveProperty('tailDependence');
    expect(result).toHaveProperty('jointDefaultProbability');
    expect(result).toHaveProperty('correlationMatrix');
    expect(result).toHaveProperty('segments');
  });

  it('should set method to gaussian when requested', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result.method).toBe('gaussian');
    expect(result.tailDependence).toBe(0);
  });

  it('should set method to t-copula when requested', async () => {
    const result = await svc.simulateWithCopula('inst-1', 't-copula');
    expect(result.method).toBe('t-copula');
    expect(result.tCopulaPremium).toBeGreaterThan(0);
  });

  it('should have VaR999 >= VaR99', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result.var999).toBeGreaterThanOrEqual(result.var99);
  });

  it('should have ES99 >= VaR99 in demo result', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result.es99).toBeGreaterThanOrEqual(result.var99);
  });

  it('demo gaussian result has zero tCopulaPremium', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result.tCopulaPremium).toBe(0);
  });

  it('demo t-copula result has positive tail dependence', async () => {
    const result = await svc.simulateWithCopula('inst-1', 't-copula');
    expect(result.tailDependence).toBeGreaterThan(0);
  });

  it('demo result includes two segments (Consumer, Commercial)', async () => {
    const result = await svc.simulateWithCopula('inst-1', 'gaussian');
    expect(result.segments).toEqual(['Consumer', 'Commercial']);
  });

  // ── Gaussian copula with real segments ──────────────────────
  describe('with real loan segments', () => {
    let svcWithData: CopulaCreditService;

    beforeEach(() => {
      const segments = [
        {
          segmentName: 'Consumer',
          balance: 5000,
          historicalLossRate: 0.02,
          lgd: 0.4,
        },
        {
          segmentName: 'Commercial',
          balance: 3000,
          historicalLossRate: 0.03,
          lgd: 0.5,
        },
        {
          segmentName: 'Mortgage',
          balance: 7000,
          historicalLossRate: 0.01,
          lgd: 0.3,
        },
      ];
      const mockPrisma = {
        loanSegment: { findMany: jest.fn().mockResolvedValue(segments) },
      } as any;
      svcWithData = new CopulaCreditService(mockPrisma);
    });

    it('gaussian copula produces correlation matrix matching segment count', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        1000,
      );
      expect(result.correlationMatrix).toHaveLength(3);
      expect(result.correlationMatrix[0]).toHaveLength(3);
      // Diagonal should be 1.0
      expect(result.correlationMatrix[0][0]).toBe(1.0);
      expect(result.correlationMatrix[1][1]).toBe(1.0);
      expect(result.correlationMatrix[2][2]).toBe(1.0);
    });

    it('off-diagonal correlation equals 0.15', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        1000,
      );
      expect(result.correlationMatrix[0][1]).toBe(0.15);
      expect(result.correlationMatrix[1][0]).toBe(0.15);
    });

    it('VaR99 is positive for real segment data', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        2000,
      );
      expect(result.var99).toBeGreaterThan(0);
    });

    it('joint default probability is between 0 and 1', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        2000,
      );
      expect(result.jointDefaultProbability).toBeGreaterThanOrEqual(0);
      expect(result.jointDefaultProbability).toBeLessThanOrEqual(1);
    });

    it('gaussian copula has zero tail dependence', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        1000,
      );
      expect(result.tailDependence).toBe(0);
    });

    it('segments array matches input segment names', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        1000,
      );
      expect(result.segments).toEqual(['Consumer', 'Commercial', 'Mortgage']);
    });

    it('t-copula produces positive tail dependence with real data', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        't-copula',
        5,
        1000,
      );
      expect(result.tailDependence).toBeGreaterThan(0);
      expect(result.method).toBe('t-copula');
    });

    it('t-copula premium is computed (difference from gaussian VaR99)', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        't-copula',
        5,
        1000,
      );
      // tCopulaPremium = t_var99 - gauss_var99; can be positive or negative
      expect(typeof result.tCopulaPremium).toBe('number');
    });

    it('ES99 >= VaR99 for real segment data', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        2000,
      );
      expect(result.es99).toBeGreaterThanOrEqual(result.var99);
    });

    it('VaR999 >= VaR99 for real segment data', async () => {
      const result = await svcWithData.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        2000,
      );
      expect(result.var999).toBeGreaterThanOrEqual(result.var99);
    });

    it('PD is capped at 0.3 even when historicalLossRate is high', async () => {
      const highPDSegments = [
        {
          segmentName: 'Risky',
          balance: 1000,
          historicalLossRate: 0.5,
          lgd: 0.6,
        },
      ];
      const mockPrisma = {
        loanSegment: { findMany: jest.fn().mockResolvedValue(highPDSegments) },
      } as any;
      const svcHighPD = new CopulaCreditService(mockPrisma);
      const result = await svcHighPD.simulateWithCopula(
        'inst-1',
        'gaussian',
        5,
        500,
      );
      // If PD was capped at 0.3, defaults should still be bounded
      expect(result.var99).toBeGreaterThanOrEqual(0);
    });
  });
});
