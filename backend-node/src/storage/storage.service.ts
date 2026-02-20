import { Injectable } from '@nestjs/common';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface UploadUrlResponse {
    uploadUrl: string;
    fileKey: string;
    fileUrl: string;
}

@Injectable()
export class StorageService {
    private s3Client: S3Client;
    private bucket: string;
    private region: string;
    private urlExpiry: number;

    constructor() {
        this.bucket = process.env.AWS_S3_BUCKET || 'spendcheck-receipts';
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.urlExpiry = parseInt(process.env.S3_PRESIGNED_URL_EXPIRY || '300');

        this.s3Client = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
    }

    /**
     * Generate a presigned URL for direct browser upload to S3
     */
    async generateUploadUrl(
        organizationId: string,
        filename: string,
        contentType: string,
    ): Promise<UploadUrlResponse> {
        // Generate unique file key
        const fileExtension = filename.split('.').pop();
        const uniqueFileName = `${uuidv4()}.${fileExtension}`;
        const fileKey = `receipts/${organizationId}/${uniqueFileName}`;

        // Create presigned PUT URL
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
            ContentType: contentType,
            Metadata: {
                organizationId,
                originalFilename: filename,
            },
        });

        const uploadUrl = await getSignedUrl(this.s3Client, command, {
            expiresIn: this.urlExpiry,
        });

        // Public URL (for fetching after upload)
        const fileUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileKey}`;

        return {
            uploadUrl,
            fileKey,
            fileUrl,
        };
    }

    /**
     * Generate a presigned URL for downloading/viewing a file
     */
    async generateDownloadUrl(fileKey: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
        });

        return await getSignedUrl(this.s3Client, command, {
            expiresIn: this.urlExpiry,
        });
    }

    /**
     * Delete a file from S3
     */
    async deleteFile(fileKey: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
        });

        await this.s3Client.send(command);
    }

    /**
     * Get public URL for a file (use for already-public files)
     */
    getPublicUrl(fileKey: string): string {
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileKey}`;
    }
}
