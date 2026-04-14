import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ReportStorageService {
  private readonly logger = new Logger(ReportStorageService.name);
  private client: S3Client | null = null;
  private bucket: string;

  /**
   * In-memory buffer cache for local-mode (no R2 configured).
   * Keyed by storage key (e.g. "reports/{jobId}/report_es.pdf").
   * Cleared after DATA_RETENTION entries to prevent unbounded growth.
   */
  private readonly localBuffers = new Map<string, Buffer>();
  private static readonly MAX_LOCAL_BUFFERS = 200;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT || process.env.AWS_S3_ENDPOINT;
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    this.bucket =
      process.env.R2_BUCKET || process.env.AWS_S3_BUCKET || 'cerniq-reports';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('Report storage (S3/R2) initialized');
    } else {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'CRITICAL: R2/S3 storage not configured in production — reports will use volatile in-memory buffer. ' +
          'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to enable persistent storage.',
        );
      }
      this.logger.warn(
        'Report storage not configured — using in-memory buffer storage (not suitable for multi-instance deployment)',
      );
    }
  }

  /** Whether cloud storage (R2/S3) is configured. */
  get isCloudConfigured(): boolean {
    return this.client !== null;
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType = 'application/pdf',
  ): Promise<string> {
    if (!this.client) {
      // Local fallback: store buffer in memory and return an API-servable path
      this.localBuffers.set(key, buffer);
      // Evict oldest if over limit
      if (this.localBuffers.size > ReportStorageService.MAX_LOCAL_BUFFERS) {
        const oldest = this.localBuffers.keys().next().value;
        if (oldest) this.localBuffers.delete(oldest);
      }
      this.logger.warn(`Stored ${key} in memory (${(buffer.length / 1024).toFixed(0)}KB) — R2 not configured`);
      return key;
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log({ event: 'report.uploaded', key });
    return key;
  }

  async getSignedUrl(key: string, expirySeconds = 86400): Promise<string> {
    if (!this.client) {
      // Local fallback: return an API path that the portal controller can serve
      return `/api/portal/reports/download/${encodeURIComponent(key)}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expirySeconds },
    );
  }

  /**
   * Retrieve a locally-stored buffer by key. Returns null if not found
   * or if cloud storage is configured (use signed URLs instead).
   */
  getLocalBuffer(key: string): Buffer | null {
    return this.localBuffers.get(key) ?? null;
  }
}
