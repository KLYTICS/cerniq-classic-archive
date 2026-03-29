import { CSVIngestionService } from './csv-ingestion.service';

describe('CSVIngestionService', () => {
  let service: CSVIngestionService;

  beforeEach(() => {
    service = new CSVIngestionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should parse valid CSV with English headers', () => {
    const csv = [
      'category,subcategory,name,balance,rate,duration,rateType',
      'asset,commercial_loans,CRE Loans,10,5.25,4.5,fixed',
      'liability,demand_deposits,Checking,8,0.50,0.1,variable',
    ].join('\n');

    const result = service.parseCSV(csv);
    expect(result.valid).toBe(true);
    expect(result.items.length).toBe(2);
    expect(result.summary.totalAssets).toBe(10);
    expect(result.summary.totalLiabilities).toBe(8);
  });

  it('should reject CSV with missing headers', () => {
    const csv = 'name,balance\nasset,10';
    const result = service.parseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should auto-convert rates > 1 to decimal', () => {
    const csv = [
      'category,subcategory,name,balance,rate,duration,rateType',
      'asset,commercial_loans,Loans,100,5.25,3,fixed',
    ].join('\n');

    const result = service.parseCSV(csv);
    expect(result.items[0].rate).toBeCloseTo(0.0525, 4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should return cooperativa template with valid structure', () => {
    const template = service.getCooperativaTemplate();
    const result = service.parseCSV(template);
    expect(result.valid).toBe(true);
    expect(result.items.length).toBeGreaterThan(20);
    expect(result.summary.totalAssets).toBeGreaterThan(0);
  });

  it('should validate row errors for invalid category', () => {
    const csv = [
      'category,subcategory,name,balance,rate,duration,rateType',
      'invalid_cat,commercial_loans,Bad Row,10,5,3,fixed',
    ].join('\n');

    const result = service.parseCSV(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('category');
  });
});
