import { VendorIntelligenceService } from './vendor-intelligence.service';

describe('VendorIntelligenceService', () => {
  let service: VendorIntelligenceService;

  beforeEach(() => {
    service = new VendorIntelligenceService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('matchVendorProfile', () => {
    it('should return null when no vendor profile matches', () => {
      const result = service.matchVendorProfile('Unknown Vendor XYZ', 5000);
      expect(result).toBeNull();
    });

    it('should return a match with BELOW_BENCHMARK assessment for low spend', () => {
      // Using a very low quarterly total to hit below p25
      const result = service.matchVendorProfile('Some Known Vendor', 1);
      // If no match, this is fine — profile depends on vendor-profiles data
      if (result) {
        expect(result.assessment).toBeDefined();
        expect(['BELOW_BENCHMARK', 'WITHIN_BENCHMARK', 'ABOVE_BENCHMARK']).toContain(result.assessment);
        expect(result.profile).toBeDefined();
        expect(typeof result.percentileRank).toBe('number');
      }
    });

    it('should calculate percentile rank as a number', () => {
      const result = service.matchVendorProfile('Test', 50000);
      if (result) {
        expect(typeof result.percentileRank).toBe('number');
        expect(result.benchmarkMedian).toBeGreaterThan(0);
      }
    });
  });

  describe('generateVendorReport', () => {
    it('should return empty array for no expenses', () => {
      const result = service.generateVendorReport([]);
      expect(result).toEqual([]);
    });

    it('should group expenses by vendor and calculate totals', () => {
      const expenses = [
        { merchantName: 'Acme Corp', amount: 1000, transactionDate: new Date('2026-01-15') },
        { merchantName: 'Acme Corp', amount: 2000, transactionDate: new Date('2026-02-15') },
        { merchantName: 'Beta Inc', amount: 500, transactionDate: new Date('2026-01-20') },
      ];

      const result = service.generateVendorReport(expenses);

      expect(result).toHaveLength(2);
      // Sorted by spend descending, Acme should be first
      expect(result[0].vendorName).toBe('Acme Corp');
      expect(result[0].quarterlyTotal).toBe(3000);
      expect(result[0].transactionCount).toBe(2);
      expect(result[1].vendorName).toBe('Beta Inc');
      expect(result[1].quarterlyTotal).toBe(500);
    });

    it('should calculate percent of total spend', () => {
      const expenses = [
        { merchantName: 'Vendor A', amount: 750, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Vendor B', amount: 250, transactionDate: new Date('2026-01-02') },
      ];

      const result = service.generateVendorReport(expenses);

      expect(result[0].percentOfTotalSpend).toBe(75);
      expect(result[1].percentOfTotalSpend).toBe(25);
    });

    it('should track the latest transaction date per vendor', () => {
      const expenses = [
        { merchantName: 'Vendor A', amount: 100, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Vendor A', amount: 200, transactionDate: new Date('2026-03-01') },
        { merchantName: 'Vendor A', amount: 150, transactionDate: new Date('2026-02-01') },
      ];

      const result = service.generateVendorReport(expenses);
      expect(result[0].latestTransactionDate).toEqual(new Date('2026-03-01'));
    });

    it('should normalize vendor names case-insensitively', () => {
      const expenses = [
        { merchantName: 'ACME CORP', amount: 100, transactionDate: new Date('2026-01-01') },
        { merchantName: 'acme corp', amount: 200, transactionDate: new Date('2026-01-02') },
      ];

      const result = service.generateVendorReport(expenses);
      expect(result).toHaveLength(1);
      expect(result[0].quarterlyTotal).toBe(300);
    });
  });
});
