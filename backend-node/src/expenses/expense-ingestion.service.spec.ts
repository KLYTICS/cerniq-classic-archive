import { ExpenseIngestionService } from './expense-ingestion.service';

describe('ExpenseIngestionService', () => {
  let service: ExpenseIngestionService;

  beforeEach(() => {
    service = new ExpenseIngestionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parseExpenseCSV parses valid CSV with English headers', () => {
    const csv = [
      'date,invoice_number,vendor,amount,category,status',
      '2025-01-15,INV-001,LUMA Energy,1500.00,utilities,PAID',
      '2025-02-01,INV-002,AT&T,250.00,telecom,PENDING',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.summary.totalAmount).toBe(1750);
    expect(result.summary.uniqueVendors).toBe(2);
  });

  it('parseExpenseCSV parses Spanish headers', () => {
    const csv = [
      'fecha,numero_factura,proveedor,monto',
      '2025-01-15,FAC-001,Claro PR,350.00',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].vendor).toBe('Claro PR');
  });

  it('parseExpenseCSV returns errors for missing required columns', () => {
    const csv = 'name,value\nTest,100';
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('Missing required columns');
  });

  it('parseExpenseCSV validates amount is positive', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-01,INV-001,Test Vendor,-100',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('amount');
  });

  it('parseExpenseCSV handles MM/DD/YYYY date format', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '03/15/2025,INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].date).toBe('2025-03-15');
  });

  // ── Coverage boost ──

  it('handles DD-MM-YYYY (European) date format', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '15-03-2025,INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].date).toBe('2025-03-15');
  });

  it('handles DD.MM.YYYY date format', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '15.03.2025,INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].date).toBe('2025-03-15');
  });

  it('rejects invalid date format', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      'not-a-date,INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('date');
  });

  it('warns for unknown category and defaults to "other"', () => {
    const csv = [
      'date,invoice_number,vendor,amount,category',
      '2025-01-15,INV-001,Test Vendor,500,unknown_cat',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].category).toBe('other');
    expect(result.warnings.some((w) => w.includes('Unknown category'))).toBe(
      true,
    );
  });

  it('warns for unknown status and defaults to "PAID"', () => {
    const csv = [
      'date,invoice_number,vendor,amount,status',
      '2025-01-15,INV-001,Test Vendor,500,unknown_status',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].status).toBe('PAID');
    expect(result.warnings.some((w) => w.includes('Unknown status'))).toBe(
      true,
    );
  });

  it('handles Spanish status aliases (pagado -> PAID)', () => {
    const csv = [
      'date,invoice_number,vendor,amount,status',
      '2025-01-15,INV-001,Test Vendor,500,pagado',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.items[0].status).toBe('PAID');
  });

  it('handles pendiente status', () => {
    const csv = [
      'date,invoice_number,vendor,amount,status',
      '2025-01-15,INV-001,Test Vendor,500,pendiente',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.items[0].status).toBe('PENDING');
  });

  it('handles cancelado status', () => {
    const csv = [
      'date,invoice_number,vendor,amount,status',
      '2025-01-15,INV-001,Test Vendor,500,cancelado',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.items[0].status).toBe('CANCELLED');
  });

  it('validates missing vendor', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,INV-001,,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('vendor');
  });

  it('validates missing date', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      ',INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('date');
  });

  it('validates missing invoice_number', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('invoice_number');
  });

  it('validates NaN amount', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,INV-001,Test Vendor,abc',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('amount');
  });

  it('strips $ and commas from amount', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,INV-001,Test Vendor,"$1,500.00"',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].amount).toBe(1500);
  });

  it('handles CSV with only header (no data rows)', () => {
    const csv = 'date,invoice_number,vendor,amount';
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('header row');
  });

  it('skips blank lines in CSV', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,INV-001,Test Vendor,500',
      '',
      '2025-02-01,INV-002,Vendor B,300',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items).toHaveLength(2);
  });

  it('computes dateRange correctly', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-03-15,INV-002,B,300',
      '2025-01-15,INV-001,A,500',
      '2025-06-01,INV-003,C,200',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.summary.dateRange).toEqual({
      from: '2025-01-15',
      to: '2025-06-01',
    });
  });

  it('defaults currency to USD when not provided', () => {
    const csv = [
      'date,invoice_number,vendor,amount',
      '2025-01-15,INV-001,Test Vendor,500',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.items[0].currency).toBe('USD');
  });

  it('accepts valid categories: utilities, insurance, telecom, audit', () => {
    const csv = [
      'date,invoice_number,vendor,amount,category',
      '2025-01-15,INV-001,V1,500,utilities',
      '2025-01-16,INV-002,V2,300,insurance',
      '2025-01-17,INV-003,V3,200,telecom',
      '2025-01-18,INV-004,V4,100,audit',
    ].join('\n');
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items[0].category).toBe('utilities');
    expect(result.items[1].category).toBe('insurance');
    expect(result.items[2].category).toBe('telecom');
    expect(result.items[3].category).toBe('audit');
  });

  it('handles \\r\\n line endings', () => {
    const csv =
      'date,invoice_number,vendor,amount\r\n2025-01-15,INV-001,Test Vendor,500\r\n';
    const result = service.parseExpenseCSV(csv);
    expect(result.valid).toBe(true);
  });
});
