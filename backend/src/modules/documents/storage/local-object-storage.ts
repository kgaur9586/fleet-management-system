import fs from 'fs/promises';
import path from 'path';
import { NotFoundError } from '../../../common/errors';
import { ObjectStorage, StoredObject } from './object-storage';

const safeKey = (key: string) => {
  const normalized = key.replace(/^local\//, '');
  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Invalid storage key');
  }
  return normalized;
};

export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root = path.resolve(process.cwd(), 'storage', 'vehicle-documents')) {
    this.root = root;
  }

  async put(input: { key: string; content: Buffer; contentType: string }): Promise<StoredObject> {
    const relativeKey = safeKey(input.key);
    const filePath = path.join(this.root, relativeKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.content, { flag: 'wx' });
    return { key: `local/${relativeKey}`, contentType: input.contentType, size: input.content.length };
  }

  async get(key: string) {
    const relativeKey = safeKey(key);
    try {
      const content = await fs.readFile(path.join(this.root, relativeKey));
      return { content, contentType: this.contentType(relativeKey) };
    } catch (error: any) {
      if (error.code === 'ENOENT') throw new NotFoundError('Stored document file not found');
      throw error;
    }
  }

  async delete(key: string) {
    const relativeKey = safeKey(key);
    try {
      await fs.unlink(path.join(this.root, relativeKey));
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  private contentType(key: string) {
    const extension = path.extname(key).toLowerCase();
    return extension === '.pdf' ? 'application/pdf' : extension === '.png' ? 'image/png' : extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
  }
}
