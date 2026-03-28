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
});
