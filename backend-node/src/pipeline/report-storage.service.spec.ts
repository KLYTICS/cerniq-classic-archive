import { ReportStorageService } from './report-storage.service';

describe('ReportStorageService', () => {
  let service: ReportStorageService;

  beforeEach(() => {
    // Clear env vars so S3 client is NOT initialized
    delete process.env.R2_ENDPOINT;
    delete process.env.AWS_S3_ENDPOINT;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.AWS_ACCESS_KEY_ID;
    service = new ReportStorageService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('upload returns key when storage is not configured', async () => {
    const result = await service.upload(
      'reports/test.pdf',
      Buffer.from('test'),
    );
    expect(result).toBe('reports/test.pdf');
  });

  it('getSignedUrl returns empty string when storage is not configured', async () => {
    const result = await service.getSignedUrl('reports/test.pdf');
    expect(result).toBe('');
  });

  it('upload accepts custom content type', async () => {
    const result = await service.upload(
      'reports/data.csv',
      Buffer.from('a,b,c'),
      'text/csv',
    );
    expect(result).toBe('reports/data.csv');
  });

  it('getSignedUrl accepts custom expiry', async () => {
    const result = await service.getSignedUrl('reports/test.pdf', 3600);
    expect(result).toBe('');
  });
});
