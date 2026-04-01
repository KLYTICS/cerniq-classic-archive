/**
 * ReportStorageService tests — covers both unconfigured (no S3) and configured (mocked S3) paths.
 */

// Mock the AWS SDK modules before imports
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { ReportStorageService } from './report-storage.service';

describe('ReportStorageService', () => {
  // ── Unconfigured (no S3 credentials) ───────────────────────────────

  describe('when storage is NOT configured', () => {
    let service: ReportStorageService;

    beforeEach(() => {
      // Clear env vars so S3 client is NOT initialized
      delete process.env.R2_ENDPOINT;
      delete process.env.AWS_S3_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      service = new ReportStorageService();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('upload returns key without calling S3', async () => {
      const result = await service.upload(
        'reports/test.pdf',
        Buffer.from('test'),
      );
      expect(result).toBe('reports/test.pdf');
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('getSignedUrl returns empty string', async () => {
      const result = await service.getSignedUrl('reports/test.pdf');
      expect(result).toBe('');
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
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

  // ── Configured (with S3/R2 credentials) ────────────────────────────

  describe('when storage IS configured', () => {
    let service: ReportStorageService;

    beforeEach(() => {
      jest.clearAllMocks();
      process.env.R2_ENDPOINT = 'https://r2.example.com';
      process.env.R2_ACCESS_KEY_ID = 'test-key-id';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_BUCKET = 'test-bucket';
      service = new ReportStorageService();
    });

    afterEach(() => {
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET;
    });

    it('initializes S3 client', () => {
      // The client is not null when credentials are provided
      expect((service as any).client).not.toBeNull();
    });

    it('upload sends PutObjectCommand to S3', async () => {
      mockSend.mockResolvedValue({});
      const buffer = Buffer.from('pdf content');
      const result = await service.upload('reports/q1-2024.pdf', buffer);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'reports/q1-2024.pdf',
        Body: buffer,
        ContentType: 'application/pdf',
      });
      expect(result).toBe('reports/q1-2024.pdf');
    });

    it('upload uses custom content type', async () => {
      mockSend.mockResolvedValue({});
      await service.upload('reports/data.csv', Buffer.from('a,b'), 'text/csv');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ContentType).toBe('text/csv');
    });

    it('upload defaults to application/pdf content type', async () => {
      mockSend.mockResolvedValue({});
      await service.upload('reports/report.pdf', Buffer.from('pdf'));

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ContentType).toBe('application/pdf');
    });

    it('getSignedUrl generates a signed URL', async () => {
      mockGetSignedUrl.mockResolvedValue('https://r2.example.com/signed?token=abc');

      const result = await service.getSignedUrl('reports/test.pdf');

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      expect(result).toBe('https://r2.example.com/signed?token=abc');
    });

    it('getSignedUrl uses custom expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://r2.example.com/signed');

      await service.getSignedUrl('reports/test.pdf', 7200);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 },
      );
    });

    it('getSignedUrl defaults to 86400 second expiry', async () => {
      mockGetSignedUrl.mockResolvedValue('https://r2.example.com/signed');

      await service.getSignedUrl('reports/test.pdf');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 86400 },
      );
    });

    it('uses AWS_S3_ENDPOINT as fallback', () => {
      // Clear ALL storage env vars first
      delete process.env.R2_ENDPOINT;
      delete process.env.R2_ACCESS_KEY_ID;
      delete process.env.R2_SECRET_ACCESS_KEY;
      delete process.env.R2_BUCKET;
      delete process.env.AWS_S3_BUCKET;

      process.env.AWS_S3_ENDPOINT = 'https://s3.amazonaws.com';
      process.env.AWS_ACCESS_KEY_ID = 'aws-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
      process.env.AWS_S3_BUCKET = 'aws-bucket';

      const s = new ReportStorageService();
      expect((s as any).client).not.toBeNull();
      expect((s as any).bucket).toBe('aws-bucket');

      delete process.env.AWS_S3_ENDPOINT;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_S3_BUCKET;
    });

    it('defaults bucket to cerniq-reports', () => {
      delete process.env.R2_BUCKET;
      delete process.env.AWS_S3_BUCKET;
      const s = new ReportStorageService();
      expect((s as any).bucket).toBe('cerniq-reports');
    });
  });
});
