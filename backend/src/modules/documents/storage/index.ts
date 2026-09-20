import { ObjectStorage } from './object-storage';
import { LocalObjectStorage } from './local-object-storage';
import { S3ObjectStorage } from './s3-object-storage';

let storage: ObjectStorage | undefined;

export const getObjectStorage = (): ObjectStorage => {
  if (!storage) {
    if (process.env.OBJECT_STORAGE_PROVIDER === 's3') {
      const bucket = process.env.OBJECT_STORAGE_BUCKET;
      if (!bucket) throw new Error('OBJECT_STORAGE_BUCKET is required for S3 storage');
      storage = new S3ObjectStorage({
        bucket,
        region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
        endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
        forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
      });
    } else {
      storage = new LocalObjectStorage();
    }
  }
  return storage;
};

export const setObjectStorage = (nextStorage: ObjectStorage) => {
  storage = nextStorage;
};
