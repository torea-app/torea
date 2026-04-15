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

  /** ボディなしでオブジェクトのメタデータのみ取得する（サイズ確認用） */
  async head(key: string): Promise<R2Object | null> {
    return this.bucket.head(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.bucket.delete(keys);
  }

  /** Range 指定付きでオブジェクトを取得する（動画ストリーミング用） */
  async getWithRange(
    key: string,
    range?: { offset: number; length?: number },
  ): Promise<R2ObjectBody | null> {
    return this.bucket.get(key, range ? { range } : undefined);
  }

  /** マルチパートアップロードを開始し、uploadId を返す */
  async createMultipartUpload(
    key: string,
    options?: { contentType?: string },
  ): Promise<{ key: string; uploadId: string }> {
    const upload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: options?.contentType
        ? { contentType: options.contentType }
        : undefined,
    });
    return { key: upload.key, uploadId: upload.uploadId };
  }

  /** パートをアップロードし、etag を返す */
  async uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: ReadableStream | ArrayBuffer,
  ): Promise<{ partNumber: number; etag: string }> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, body);
    return { partNumber: part.partNumber, etag: part.etag };
  }

  /** マルチパートアップロードを完了する */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    await upload.complete(
      parts.map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
      })),
    );
  }

  /** マルチパートアップロードを中止する */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    await upload.abort();
  }
}
