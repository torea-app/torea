import {
  NotFoundError,
  ValidationError,
} from "../../domain/errors/domain.error";
import type {
  RecordingStatus,
  UploadedPart,
} from "../../domain/types/recording";
import type { createRecordingRepository } from "../../infrastructure/repositories/recording.repository";

/** R2StorageClient のうち、このサービスが必要とするメソッドのみを定義 */
type StorageClient = {
  createMultipartUpload(
    key: string,
    options?: { contentType?: string },
  ): Promise<{ key: string; uploadId: string }>;
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: ReadableStream | ArrayBuffer,
  ): Promise<{ partNumber: number; etag: string }>;
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: UploadedPart[],
  ): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  delete(key: string): Promise<void>;
};

type QueueClient = {
  send(message: unknown): Promise<void>;
};

type Deps = {
  repo: ReturnType<typeof createRecordingRepository>;
  storage: StorageClient;
  generateId: () => string;
  queue?: QueueClient;
  skipVideoProcessing?: boolean;
};

export function createRecordingService({
  repo,
  storage,
  generateId,
  queue,
  skipVideoProcessing,
}: Deps) {
  return {
    /**
     * 録画セッションを開始する。
     * DB にレコードを作成し、R2 multipart upload を開始する。
     */
    async startRecording(params: {
      organizationId: string;
      userId: string;
      title: string;
      mimeType: string;
    }) {
      const id = generateId();
      const ext = params.mimeType === "video/mp4" ? "mp4" : "webm";
      const r2Key = `recordings/${params.organizationId}/${id}/video.${ext}`;

      // R2 multipart upload を開始
      const { uploadId } = await storage.createMultipartUpload(r2Key, {
        contentType: params.mimeType,
      });

      // DB にレコード作成
      const status: RecordingStatus = "uploading";
      const recording = await repo.create({
        id,
        organizationId: params.organizationId,
        userId: params.userId,
        title: params.title,
        status,
        r2Key,
        uploadId,
        mimeType: params.mimeType,
      });

      return { recording, uploadId };
    },

    /**
     * パートをアップロードする。
     * recording の status が uploading であることを検証する。
     */
    async uploadPart(params: {
      recordingId: string;
      organizationId: string;
      partNumber: number;
      body: ReadableStream | ArrayBuffer;
    }) {
      const rec = await repo.findById(
        params.recordingId,
        params.organizationId,
      );
      if (!rec) {
        throw new NotFoundError("Recording", params.recordingId);
      }
      if (rec.status !== "uploading") {
        throw new ValidationError("Recording is not in uploading state");
      }

      return storage.uploadPart(
        rec.r2Key,
        rec.uploadId,
        params.partNumber,
        params.body,
      );
    },

    /**
     * 録画を完了する。
     * R2 multipart を complete し、DB status を completed に更新する。
     */
    async completeRecording(params: {
      recordingId: string;
      organizationId: string;
      parts: UploadedPart[];
      durationMs?: number;
      fileSize?: number;
    }) {
      const rec = await repo.findById(
        params.recordingId,
        params.organizationId,
      );
      if (!rec) {
        throw new NotFoundError("Recording", params.recordingId);
      }
      if (rec.status !== "uploading") {
        throw new ValidationError("Recording is not in uploading state");
      }

      // R2 multipart complete
      await storage.completeMultipartUpload(
        rec.r2Key,
        rec.uploadId,
        params.parts,
      );

      // Queue がある場合は processing → Queue 送信、なければ直接 completed
      if (queue && !skipVideoProcessing) {
        const updated = await repo.updateStatus(rec.id, params.organizationId, {
          status: "processing",
          fileSize: params.fileSize,
          durationMs: params.durationMs,
        });

        await queue.send({
          recordingId: rec.id,
          organizationId: params.organizationId,
          r2Key: rec.r2Key,
        });

        return updated;
      }

      // Queue なし or スキップ時は直接 completed
      return repo.updateStatus(rec.id, params.organizationId, {
        status: "completed",
        fileSize: params.fileSize,
        durationMs: params.durationMs,
        completedAt: new Date(),
      });
    },

    /**
     * 録画を中止する。
     * R2 multipart を abort し、DB status を failed に更新する。
     */
    async abortRecording(params: {
      recordingId: string;
      organizationId: string;
    }) {
      const rec = await repo.findById(
        params.recordingId,
        params.organizationId,
      );
      if (!rec) {
        throw new NotFoundError("Recording", params.recordingId);
      }
      if (rec.status !== "uploading") {
        throw new ValidationError("Recording is not in uploading state");
      }

      await storage.abortMultipartUpload(rec.r2Key, rec.uploadId);

      return repo.updateStatus(rec.id, params.organizationId, {
        status: "failed",
      });
    },

    /** 録画一覧を取得する */
    async listRecordings(params: {
      organizationId: string;
      limit: number;
      offset: number;
    }) {
      const [recordings, total] = await Promise.all([
        repo.findByOrganization(params.organizationId, {
          limit: params.limit,
          offset: params.offset,
        }),
        repo.countByOrganization(params.organizationId),
      ]);
      return { recordings, total };
    },

    /** 録画詳細を取得する */
    async getRecording(params: {
      recordingId: string;
      organizationId: string;
    }) {
      return repo.findById(params.recordingId, params.organizationId);
    },

    /**
     * 録画を削除する。
     * R2 オブジェクトと DB レコードを両方削除する。
     */
    async deleteRecording(params: {
      recordingId: string;
      organizationId: string;
    }) {
      const rec = await repo.findById(
        params.recordingId,
        params.organizationId,
      );
      if (!rec) {
        throw new NotFoundError("Recording", params.recordingId);
      }

      // uploading 中なら multipart abort を試みる（失敗しても続行）
      if (rec.status === "uploading") {
        try {
          await storage.abortMultipartUpload(rec.r2Key, rec.uploadId);
        } catch {
          // abort 失敗は無視（R2 が 7 日後に自動削除する）
        }
      }

      // completed or processing ならオブジェクト削除
      if (rec.status === "completed" || rec.status === "processing") {
        await storage.delete(rec.r2Key);
      }

      await repo.delete(rec.id, params.organizationId);
    },
  };
}
