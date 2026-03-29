import { StorageService } from './storage.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest
    .fn()
    .mockResolvedValue('https://presigned-url.example.com'),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateUploadUrl returns upload URL, file key, and file URL', async () => {
    const result = await service.generateUploadUrl(
      'org-1',
      'receipt.jpg',
      'image/jpeg',
    );
    expect(result).toHaveProperty('uploadUrl');
    expect(result).toHaveProperty('fileKey');
    expect(result).toHaveProperty('fileUrl');
    expect(result.fileKey).toContain('receipts/org-1/');
    expect(result.fileKey).toMatch(/\.jpg$/);
  });

  it('generateDownloadUrl returns a presigned URL', async () => {
    const result = await service.generateDownloadUrl('receipts/org-1/test.jpg');
    expect(result).toBe('https://presigned-url.example.com');
  });

  it('getPublicUrl returns S3 public URL', () => {
    const result = service.getPublicUrl('receipts/org-1/test.jpg');
    expect(result).toContain('s3.');
    expect(result).toContain('receipts/org-1/test.jpg');
  });

  it('deleteFile does not throw', async () => {
    await expect(
      service.deleteFile('receipts/org-1/test.jpg'),
    ).resolves.not.toThrow();
  });
});
