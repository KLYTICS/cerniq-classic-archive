import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);
  private client: S3Client | null = null;
  private bucket: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT || process.env.AWS_S3_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET || process.env.AWS_S3_BUCKET || 'cerniq-reports';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('Report storage (S3/R2) initialized');
    } else {
      this.logger.warn('Report storage not configured — reports will use local paths');
    }
  }

  async upload(key: string, buffer: Buffer, contentType = 'application/pdf'): Promise<string> {
    if (!this.client) {
      this.logger.warn(`Storage not configured, skipping upload for ${key}`);
      return key;
    }

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    this.logger.log({ event: 'report.uploaded', key });
    return key;
  }

  async getSignedUrl(key: string, expirySeconds = 86400): Promise<string> {
    if (!this.client) return '';

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expirySeconds },
    );
  }
}
