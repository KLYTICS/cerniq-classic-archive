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
});
