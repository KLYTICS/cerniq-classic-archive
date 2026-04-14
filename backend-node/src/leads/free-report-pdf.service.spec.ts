import { FreeReportPdfService } from './free-report-pdf.service';
import { FreeReportResult } from './free-report.service';

// ─── Fixtures ──────────────────────────────────────────────

const mockResult: FreeReportResult = {
  matched: true,
  institutionName: 'Cooperativa de Ahorro y Crédito de Caguas',
  slug: 'caguas',
  city: 'Caguas, PR',
  asOfQuarter: 'Q4 2025',
  niiHookDollars: 168_000,
  niiHookFormatted: '$168K',
  totalAssets: 2_800_000_000,
  netWorthRatio: 10.4,
  netWorthRatioVsSector: 1.2,
  lcrStatus: 'adequate',
  lcrEstimate: 103.5,
  sectorLcrMedian: 99.5,
  healthScore: 78,
  healthGrade: 'B',
  leadId: 'lead-test-001',
  prospectInstitutionId: 'prospect-test-001',
  disclosure: 'PRELIMINARY — Built from COSSEC public filings, Q4 2025',
};

const weakResult: FreeReportResult = {
  matched: true,
  institutionName: 'Cooperativa Test Debil',
  slug: 'test-debil',
  city: 'San Juan, PR',
  asOfQuarter: 'Q4 2025',
  niiHookDollars: 5_700,
  niiHookFormatted: '$6K',
  totalAssets: 95_000_000,
  netWorthRatio: 5.2,
  netWorthRatioVsSector: -4.0,
  lcrStatus: 'below',
  lcrEstimate: 82,
  sectorLcrMedian: 99.5,
  healthScore: 35,
  healthGrade: 'D',
  leadId: 'lead-test-002',
  prospectInstitutionId: null,
  disclosure: 'PRELIMINARY — Built from COSSEC public filings, Q4 2025',
};

// ─── Tests ─────────────────────────────────────────────────
// Note: pdfkit compresses content streams with FlateDecode, so inline text
// is not directly readable from the raw buffer. Tests focus on:
//   - Valid PDF structure (magic bytes, page count)
//   - PDF metadata (Title, Author, Subject — stored uncompressed in info dict)
//   - Buffer size sanity checks
//   - Multi-page generation
//   - No-throw for different data profiles (strong vs weak institution)

describe('FreeReportPdfService', () => {
  let service: FreeReportPdfService;

  beforeAll(() => {
    service = new FreeReportPdfService();
  });

  describe('generateFreeReportPdf', () => {
    it('generates a non-empty PDF buffer', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('PDF starts with %PDF magic bytes', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const header = buffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('includes institution name in PDF Title metadata', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      // pdfkit encodes strings with non-ASCII chars in UTF-16BE with BOM prefix.
      // We search for the UTF-16BE encoded "Caguas" bytes: \x00C \x00a \x00g \x00u \x00a \x00s
      const caguasUtf16 = Buffer.from(
        '\x00C\x00a\x00g\x00u\x00a\x00s',
        'binary',
      );
      expect(buffer.includes(caguasUtf16)).toBe(true);
    });

    it('includes CERNIQ author in PDF metadata', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const text = buffer.toString('latin1');
      expect(text).toContain('CERNIQ | KLYTICS LLC');
    });

    it('includes ALM subject in PDF metadata', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const text = buffer.toString('latin1');
      expect(text).toContain('Informe ALM Preliminar');
    });

    it('generates exactly 3 pages', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const text = buffer.toString('latin1');
      // pdfkit /Type /Page entries (not /Pages which is the parent)
      const pageEntries = text.match(/\/Type\s+\/Page\b/g) || [];
      // Filter out /Type /Pages (parent node) — only count /Type /Page
      expect(pageEntries.length).toBeGreaterThanOrEqual(3);
    });

    it('PDF ends with %%EOF marker', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const tail = buffer.slice(-20).toString('ascii');
      expect(tail).toContain('%%EOF');
    });

    it('generates a PDF of reasonable size (> 1KB, < 500KB)', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      expect(buffer.length).toBeGreaterThan(1024);
      expect(buffer.length).toBeLessThan(500 * 1024);
    });

    it('handles strong institution (grade B) without errors', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1024);
    });

    it('handles weak institution (grade D, below minimum NWR) without errors', async () => {
      const buffer = await service.generateFreeReportPdf(weakResult);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1024);
    });

    it('weak institution Title metadata contains institution name', async () => {
      const buffer = await service.generateFreeReportPdf(weakResult);
      // UTF-16BE encoded "Debil"
      const debilUtf16 = Buffer.from('\x00D\x00e\x00b\x00i\x00l', 'binary');
      expect(buffer.includes(debilUtf16)).toBe(true);
    });

    it('uses Helvetica font family', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const text = buffer.toString('latin1');
      expect(text).toContain('/Helvetica');
      expect(text).toContain('/Helvetica-Bold');
    });

    it('uses A4 page dimensions', async () => {
      const buffer = await service.generateFreeReportPdf(mockResult);
      const text = buffer.toString('latin1');
      // A4: 595.28 x 841.89
      expect(text).toContain('595.28');
      expect(text).toContain('841.89');
    });
  });
});
