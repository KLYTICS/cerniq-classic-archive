import { NSFRService } from './nsfr.service';

describe('NSFRService', () => {
  let service: NSFRService;

  describe('demo mode (no balance sheet)', () => {
    beforeEach(() => {
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      service = new NSFRService(mockPrisma);
    });

    it('should return demo NSFR of 112.4%', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.nsfr).toBeCloseTo(112.4, 1);
      expect(result.status).toBe('compliant');
    });

    it('surplus should be ASF - RSF', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.surplus).toBeCloseTo(
        result.asf.total - result.rsf.total,
        0,
      );
    });

    it('should include recommendations', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('interpretation should mention NSFR percentage', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.interpretation).toContain('112.4%');
    });
  });

  it('compliant status when NSFR >= 100', async () => {
    const mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    service = new NSFRService(mockPrisma);
    const result = await service.calculateNSFR('inst-1');
    expect(result.nsfr).toBeGreaterThanOrEqual(100);
    expect(result.status).toBe('compliant');
  });

  // ── ASF/RSF factor application with real data ──────────────
  describe('with real balance sheet items', () => {
    let service: NSFRService;

    beforeEach(() => {
      const items = [
        // Liabilities (negative balances) — ASF side
        { category: 'equity', name: 'Retained Earnings', balance: -500 },
        { category: 'deposit', name: 'Savings Account', balance: -1000 },
        { category: 'deposit', name: 'Term Certificate', balance: -600 },
        { category: 'borrowing', name: 'FHLB Advance', balance: -200 },
        // Assets (positive balances) — RSF side
        { category: 'cash', name: 'Cash on Hand', balance: 300 },
        { category: 'investment', name: 'Treasury Bond', balance: 400 },
        { category: 'loan', name: 'Consumer Loan', balance: 800 },
        { category: 'loan', name: 'Mortgage Loan', balance: 500 },
        { category: 'fixed', name: 'Office Building', balance: 200 },
      ];
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue(items) },
      } as any;
      service = new NSFRService(mockPrisma);
    });

    it('applies 100% ASF factor to equity/capital items', async () => {
      const result = await service.calculateNSFR('inst-1');
      const capitalCat = result.asf.categories.find(c => c.category === 'Regulatory Capital');
      expect(capitalCat).toBeDefined();
      expect(capitalCat!.factor).toBe(1.0);
      expect(capitalCat!.weightedAmount).toBe(capitalCat!.balance);
    });

    it('applies 95% ASF factor to stable deposits (non-term)', async () => {
      const result = await service.calculateNSFR('inst-1');
      const stableCat = result.asf.categories.find(c => c.category === 'Stable Deposits (insured)');
      expect(stableCat).toBeDefined();
      expect(stableCat!.factor).toBe(0.95);
      expect(stableCat!.weightedAmount).toBeCloseTo(stableCat!.balance * 0.95, 0);
    });

    it('applies 0% RSF factor to cash', async () => {
      const result = await service.calculateNSFR('inst-1');
      const cashCat = result.rsf.categories.find(c => c.category === 'Cash & Reserves');
      expect(cashCat).toBeDefined();
      expect(cashCat!.weightedAmount).toBe(0);
    });

    it('NSFR ratio is calculated correctly as (ASF/RSF)*100', async () => {
      const result = await service.calculateNSFR('inst-1');
      const expectedNsfr = (result.asf.total / result.rsf.total) * 100;
      expect(result.nsfr).toBeCloseTo(expectedNsfr, 1);
    });

    it('breach status returned when NSFR < 90', async () => {
      // Create a scenario with very low ASF and high RSF
      const lowFundingItems = [
        { category: 'other', name: 'Short-term Payable', balance: -100 },
        { category: 'loan', name: 'Long-term Loan Portfolio', balance: 5000 },
      ];
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue(lowFundingItems) },
      } as any;
      const breachService = new NSFRService(mockPrisma);
      const result = await breachService.calculateNSFR('inst-1');
      expect(result.status).toBe('breach');
      expect(result.nsfr).toBeLessThan(90);
      expect(result.interpretation).toContain('critically');
    });
  });
});
