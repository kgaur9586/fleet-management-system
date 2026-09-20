export interface StoredObject {
  key: string;
  contentType: string;
  size: number;
}

export interface ObjectStorage {
  put(input: { key: string; content: Buffer; contentType: string }): Promise<StoredObject>;
  get(key: string): Promise<{ content: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
}
