import { ExcelExportService } from './excel-export.service';

describe('ExcelExportService', () => {
  let service: ExcelExportService;
  let almEnterprise: any;

  beforeEach(() => {
    almEnterprise = {
      getALMSummary: jest.fn().mockResolvedValue({
        institution: { name: 'Coop Test', reportingDate: '2026-01-31T00:00:00Z' },
        riskScore: 72,
        durationGap: {
          assetDuration: 3.5,
          liabilityDuration: 2.1,
          durationGap: 1.4,
          riskProfile: 'asset-sensitive',
        },
        liquidity: { lcr: 145, hqla: 50, netOutflows: 34, status: 'compliant' },
        topRisks: ['Duration mismatch', 'Rate concentration'],
        recommendations: ['Shorten asset duration'],
      }),
      getCOSSECCompliance: jest.fn().mockResolvedValue({
        ratios: [
          {
            id: 1,
            name: 'Capital Ratio',
            value: 12.5,
            unit: '%',
            threshold: '>= 7%',
            status: 'pass',
            description: 'Adequate capital',
            examReadinessContribution: 8,
          },
          {
            id: 2,
            name: 'Liquidity Ratio',
            value: 3.2,
            unit: '%',
            threshold: '>= 5%',
            status: 'fail',
            description: 'Below minimum',
            examReadinessContribution: 2,
          },
        ],
        examReadinessScore: 85,
        overallStatus: 'conditional',
      }),
      listBalanceSheetItems: jest.fn().mockResolvedValue({
        items: [
          {
            category: 'asset',
            subcategory: 'loans',
            name: 'Consumer Loans',
            balance: 45000000,
            rate: 0.055,
            duration: 4.2,
            rateType: 'fixed',
          },
          {
            category: 'liability',
            subcategory: 'deposits',
            name: 'Savings',
            balance: 30000000,
            rate: 0.02,
            duration: 0.5,
            rateType: 'variable',
          },
        ],
      }),
      calculateNIISensitivity: jest.fn().mockResolvedValue({
        baseNII: 2.5,
        scenarios: [
          {
            name: '+100bps',
            shiftBps: 100,
            niImpact: 0.3,
            niImpactPct: 12,
            mveImpact: -1.2,
            mveImpactPct: -3.5,
          },
        ],
        riskRating: 'moderate',
      }),
    };

    service = new ExcelExportService(almEnterprise);
  });

  describe('exportToExcel', () => {
    it('should return a Buffer', async () => {
      const result = await service.exportToExcel('inst_001');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should produce valid XML Spreadsheet 2003 header', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(xml).toContain('<Workbook');
    });

    it('should include all four worksheet tabs', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('ss:Name="Executive Summary"');
      expect(xml).toContain('ss:Name="COSSEC Ratios"');
      expect(xml).toContain('ss:Name="Balance Sheet"');
      expect(xml).toContain('ss:Name="NII Sensitivity"');
    });

    it('should include institution name in Executive Summary', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('Coop Test');
    });

    it('should include risk score value', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('>72<');
    });

    it('should include COSSEC ratio data', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('Capital Ratio');
      expect(xml).toContain('PASS');
      expect(xml).toContain('FAIL');
    });

    it('should include balance sheet items with proper categories', async () => {
      const result = await service.exportToExcel('inst_001');
      const xml = result.toString('utf-8');
      expect(xml).toContain('Consumer Loans');
      expect(xml).toContain('--- ASSETS ---');
      expect(xml).toContain('--- LIABILITIES ---');
    });

    it('should handle errors from almEnterprise gracefully', async () => {
      almEnterprise.getALMSummary.mockRejectedValue(new Error('DB down'));
      almEnterprise.getCOSSECCompliance.mockRejectedValue(new Error('DB down'));
      almEnterprise.calculateNIISensitivity.mockRejectedValue(new Error('timeout'));

      const result = await service.exportToExcel('inst_002');
      const xml = result.toString('utf-8');
      // Should still produce a valid workbook with empty/default data
      expect(xml).toContain('<Workbook');
      expect(xml).toContain('</Workbook>');
    });

    it('should show placeholder message when no balance sheet items', async () => {
      almEnterprise.listBalanceSheetItems.mockResolvedValue({ items: [] });
      const result = await service.exportToExcel('inst_003');
      const xml = result.toString('utf-8');
      expect(xml).toContain('No balance sheet data');
    });

    it('should escape XML special characters', async () => {
      almEnterprise.getALMSummary.mockResolvedValue({
        institution: { name: 'Test & <Institution>', reportingDate: '2026-01-31T00:00:00Z' },
        riskScore: 50,
        topRisks: ['Risk with "quotes" & <tags>'],
        recommendations: [],
      });
      const result = await service.exportToExcel('inst_004');
      const xml = result.toString('utf-8');
      expect(xml).toContain('Test &amp; &lt;Institution&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).not.toContain('& <');
    });
  });
});
