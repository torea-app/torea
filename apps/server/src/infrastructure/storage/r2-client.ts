export class R2StorageClient {
  constructor(private bucket: R2Bucket) {}

  async upload(
    key: string,
    body: ReadableStream | ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType },
    });
    return key;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.bucket.delete(keys);
  }
}
