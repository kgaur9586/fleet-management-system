import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NotFoundError } from '../../../common/errors';
import { ObjectStorage, StoredObject } from './object-storage';

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: { bucket: string; region: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string; forcePathStyle?: boolean }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: options.accessKeyId && options.secretAccessKey
        ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
        : undefined,
    });
  }

  async put(input: { key: string; content: Buffer; contentType: string }): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: input.content, ContentType: input.contentType }));
    return { key: `s3/${input.key}`, contentType: input.contentType, size: input.content.length };
  }

  async get(key: string) {
    const objectKey = key.replace(/^s3\//, '');
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      if (!result.Body) throw new NotFoundError('Stored document file not found');
      const content = Buffer.from(await result.Body.transformToByteArray());
      return { content, contentType: result.ContentType ?? 'application/octet-stream' };
    } catch (error: any) {
      if (error instanceof NotFoundError || error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new NotFoundError('Stored document file not found');
      }
      throw error;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key.replace(/^s3\//, '') }));
  }
}
