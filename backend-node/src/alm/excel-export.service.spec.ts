import { describe, expect, it, jest } from '@jest/globals';
import { ExcelExportService } from './excel-export.service';

describe('Excel Export Service', () => {
  it('builds a multi-sheet workbook with escaped operator-facing fields', async () => {
    const almEnterprise: any = {
      getALMSummary: jest.fn().mockResolvedValue({
        institution: {
          name: 'CerniQ & Co <Desk>',
          reportingDate: '2026-03-29T00:00:00.000Z',
        },
        riskScore: 63,
        durationGap: {
          assetDuration: 3.2,
          liabilityDuration: 1.5,
          durationGap: 1.7,
          riskProfile: 'Watch',
        },
        liquidity: { lcr: 98, hqla: 250.45 },
      }),
      getCOSSECCompliance: jest.fn().mockResolvedValue({
        ratios: [
          { name: 'Liquidity', actual: 98, minimum: 100, status: 'warn' },
        ],
      }),
      listBalanceSheetItems: jest.fn().mockResolvedValue({
        items: [
          {
            category: 'asset',
            subcategory: 'Loans',
            name: 'Commercial "A"&B',
            balance: 100.456,
            rate: 0.0825,
            duration: 3.4,
            rateType: 'fixed',
          },
          {
            category: 'liability',
            subcategory: 'Deposits',
            name: 'Core Deposits',
            balance: 75.1,
            rate: 0.021,
            duration: 0.5,
            rateType: 'floating',
          },
        ],
      }),
      calculateNIISensitivity: jest.fn().mockResolvedValue({
        baseNII: 42.3,
        riskRating: 'moderate',
        scenarios: [
          {
            name: '-7% Day',
            shiftBps: -700,
            niImpact: -4.8,
            niImpactPct: -11.2,
            mveImpact: -7.4,
            mveImpactPct: -6.1,
          },
        ],
      }),
    };

    const service = new ExcelExportService(almEnterprise as any);
    const workbook = await service.exportToExcel('inst-1234567890');
    const xml = workbook.toString('utf8');

    expect(workbook).toBeInstanceOf(Buffer);
    expect(xml).toContain('<Workbook');
    expect(xml).toContain('Worksheet ss:Name="Executive Summary"');
    expect(xml).toContain('Worksheet ss:Name="COSSEC Ratios"');
    expect(xml).toContain('Worksheet ss:Name="Balance Sheet"');
    expect(xml).toContain('Worksheet ss:Name="NII Sensitivity"');
    expect(xml).toContain('CerniQ &amp; Co &lt;Desk&gt;');
    expect(xml).toContain('Commercial &quot;A&quot;&amp;B');
    expect(xml).toContain('-7% Day');
  });

  it('degrades gracefully when upstream summary calls fail', async () => {
    const almEnterprise: any = {
      getALMSummary: jest.fn().mockRejectedValue(new Error('summary down')),
      getCOSSECCompliance: jest
        .fn()
        .mockRejectedValue(new Error('cossec down')),
      listBalanceSheetItems: jest
        .fn()
        .mockRejectedValue(new Error('items down')),
      calculateNIISensitivity: jest
        .fn()
        .mockRejectedValue(new Error('nii down')),
    };

    const service = new ExcelExportService(almEnterprise as any);
    const xml = (await service.exportToExcel('inst-1')).toString('utf8');

    expect(xml).toContain('Unknown Institution');
    expect(xml).toContain(
      'No balance sheet data. Upload your balance sheet to populate this sheet.',
    );
    expect(xml).toContain('Risk Rating');
    expect(xml).toContain('N/A');
  });
});
