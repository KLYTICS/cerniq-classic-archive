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
    it('returns null when no profile matches', () => {
      expect(service.matchVendorProfile('Unknown Vendor XYZ', 5000)).toBeNull();
    });

    it('matches LUMA Energy by keyword', () => {
      const r = service.matchVendorProfile('LUMA Energy Payment', 28000);
      expect(r).not.toBeNull();
      expect(r!.profile.vendorType).toBe('UTILITY_ELECTRIC');
    });

    it('matches case-insensitively', () => {
      const r = service.matchVendorProfile('PREPA Electric Bill', 30000);
      expect(r).not.toBeNull();
    });

    it('returns BELOW_BENCHMARK for spend below p25', () => {
      const r = service.matchVendorProfile('LUMA Energy', 1000);
      expect(r!.assessment).toBe('BELOW_BENCHMARK');
      expect(r!.assessmentEs).toBe('POR DEBAJO');
    });

    it('returns WITHIN_BENCHMARK for spend between p25 and p75', () => {
      const r = service.matchVendorProfile('LUMA Energy', 30000);
      expect(r!.assessment).toBe('WITHIN_BENCHMARK');
      expect(r!.assessmentEs).toBe('DENTRO DEL RANGO');
    });

    it('returns ABOVE_BENCHMARK for spend above p75', () => {
      const r = service.matchVendorProfile('LUMA Energy', 60000);
      expect(r!.assessment).toBe('ABOVE_BENCHMARK');
      expect(r!.assessmentEs).toBe('POR ENCIMA');
    });

    it('percentile rank ~50 at median', () => {
      const r = service.matchVendorProfile('LUMA Energy', 28000);
      expect(r!.percentileRank).toBeCloseTo(50, 0);
    });

    it('percentile rank between 50-75 for spend between median and p75', () => {
      const r = service.matchVendorProfile('LUMA Energy', 35000);
      expect(r!.percentileRank).toBeGreaterThan(50);
      expect(r!.percentileRank).toBeLessThan(75);
    });

    it('percentile rank >75 for spend above p75', () => {
      const r = service.matchVendorProfile('LUMA Energy', 60000);
      expect(r!.percentileRank).toBeGreaterThan(75);
    });

    it('percentile rank between 25-50 for spend between p25 and median', () => {
      const r = service.matchVendorProfile('LUMA Energy', 23000);
      expect(r!.percentileRank).toBeGreaterThan(25);
      expect(r!.percentileRank).toBeLessThan(50);
    });

    it('percentile rank <25 for spend below p25', () => {
      const r = service.matchVendorProfile('LUMA Energy', 10000);
      expect(r!.percentileRank).toBeLessThan(25);
    });

    it('matches AAA water utility', () => {
      const r = service.matchVendorProfile('AAA Acueductos Payment', 6000);
      expect(r).not.toBeNull();
      expect(r!.profile.vendorType).toBe('UTILITY_WATER');
    });

    it('matches Claro telecom', () => {
      const r = service.matchVendorProfile('Claro PR monthly bill', 14000);
      expect(r).not.toBeNull();
      expect(r!.profile.vendorType).toBe('TELECOM');
    });

    it('includes benchmarkMedian and institutionQuarterlyTotal', () => {
      const r = service.matchVendorProfile('LUMA Energy', 28000);
      expect(r!.benchmarkMedian).toBeGreaterThan(0);
      expect(r!.institutionQuarterlyTotal).toBe(28000);
    });

    it('trims whitespace from vendor name', () => {
      const r = service.matchVendorProfile('  LUMA Energy  ', 28000);
      expect(r).not.toBeNull();
    });
  });

  describe('generateVendorReport', () => {
    it('returns empty array for no expenses', () => {
      expect(service.generateVendorReport([])).toEqual([]);
    });

    it('groups expenses by vendor and calculates totals', () => {
      const expenses = [
        { merchantName: 'Acme Corp', amount: 1000, transactionDate: new Date('2026-01-15') },
        { merchantName: 'Acme Corp', amount: 2000, transactionDate: new Date('2026-02-15') },
        { merchantName: 'Beta Inc', amount: 500, transactionDate: new Date('2026-01-20') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r).toHaveLength(2);
      expect(r[0].vendorName).toBe('Acme Corp');
      expect(r[0].quarterlyTotal).toBe(3000);
      expect(r[0].transactionCount).toBe(2);
      expect(r[1].vendorName).toBe('Beta Inc');
      expect(r[1].quarterlyTotal).toBe(500);
    });

    it('calculates percent of total spend', () => {
      const expenses = [
        { merchantName: 'Vendor A', amount: 750, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Vendor B', amount: 250, transactionDate: new Date('2026-01-02') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r[0].percentOfTotalSpend).toBe(75);
      expect(r[1].percentOfTotalSpend).toBe(25);
    });

    it('tracks latest transaction date per vendor', () => {
      const expenses = [
        { merchantName: 'Vendor A', amount: 100, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Vendor A', amount: 200, transactionDate: new Date('2026-03-01') },
        { merchantName: 'Vendor A', amount: 150, transactionDate: new Date('2026-02-01') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r[0].latestTransactionDate).toEqual(new Date('2026-03-01'));
    });

    it('normalizes vendor names case-insensitively', () => {
      const expenses = [
        { merchantName: 'ACME CORP', amount: 100, transactionDate: new Date('2026-01-01') },
        { merchantName: 'acme corp', amount: 200, transactionDate: new Date('2026-01-02') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r).toHaveLength(1);
      expect(r[0].quarterlyTotal).toBe(300);
    });

    it('sorts by spend descending', () => {
      const expenses = [
        { merchantName: 'Small', amount: 100, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Big', amount: 10000, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Medium', amount: 1000, transactionDate: new Date('2026-01-01') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r[0].vendorName).toBe('Big');
      expect(r[1].vendorName).toBe('Medium');
      expect(r[2].vendorName).toBe('Small');
    });

    it('matches known profiles in report', () => {
      const expenses = [
        { merchantName: 'LUMA Energy', amount: 28000, transactionDate: new Date('2026-01-01') },
        { merchantName: 'Unknown XYZ', amount: 5000, transactionDate: new Date('2026-01-01') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r.find((v) => v.vendorName === 'LUMA Energy')!.match).not.toBeNull();
      expect(r.find((v) => v.vendorName === 'Unknown XYZ')!.match).toBeNull();
    });

    it('rounds quarterlyTotal to 2 decimal places', () => {
      const expenses = [
        { merchantName: 'V', amount: 33.333, transactionDate: new Date('2026-01-01') },
        { merchantName: 'V', amount: 66.667, transactionDate: new Date('2026-01-01') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r[0].quarterlyTotal).toBe(100);
    });

    it('handles single expense', () => {
      const expenses = [
        { merchantName: 'Solo', amount: 500, transactionDate: new Date('2026-03-15') },
      ];
      const r = service.generateVendorReport(expenses);
      expect(r).toHaveLength(1);
      expect(r[0].percentOfTotalSpend).toBe(100);
      expect(r[0].transactionCount).toBe(1);
    });
  });
});
