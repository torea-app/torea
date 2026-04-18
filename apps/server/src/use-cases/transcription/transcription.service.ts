import { NotFoundError } from "../../domain/errors/domain.error";
import type { WebhookEventEnvelope } from "../../domain/types/webhook-events";
import type {
  createTranscriptionRepository,
  TranscriptionRow,
} from "../../infrastructure/repositories/transcription.repository";

type Deps = {
  repo: ReturnType<typeof createTranscriptionRepository>;
  generateId: () => string;
  queue?: Queue;
  skipTranscription?: boolean;
  /** Webhook 発火用 (optional) */
  onEvent?: (envelope: WebhookEventEnvelope) => Promise<void>;
};

export function createTranscriptionService({
  repo,
  generateId,
  queue,
  skipTranscription,
  onEvent,
}: Deps) {
  async function emitSafe(envelope: WebhookEventEnvelope): Promise<void> {
    if (!onEvent) return;
    try {
      await onEvent(envelope);
    } catch (err) {
      console.error("Webhook emit failed", err);
    }
  }
  return {
    /**
     * 文字起こしジョブを開始する。
     * transcription レコードを "pending" で作成し、Queue にエンキューする。
     */
    async enqueue(params: {
      recordingId: string;
      organizationId: string;
      r2Key: string;
    }): Promise<TranscriptionRow | null> {
      if (skipTranscription) return null;

      // 既に transcription が存在する場合はスキップ
      const existing = await repo.findByRecordingId(
        params.recordingId,
        params.organizationId,
      );
      if (existing) return existing;

      const transcription = await repo.create({
        id: generateId(),
        recordingId: params.recordingId,
        organizationId: params.organizationId,
        status: "pending",
        model: "whisper-large-v3-turbo",
      });

      if (queue) {
        await queue.send({
          type: "transcription" as const,
          transcriptionId: transcription.id,
          recordingId: params.recordingId,
          organizationId: params.organizationId,
          r2Key: params.r2Key,
        });
      }

      await emitSafe({
        id: generateId(),
        name: "transcription.started",
        version: "v1",
        createdAt: new Date().toISOString(),
        organizationId: params.organizationId,
        payload: {
          transcriptionId: transcription.id,
          recordingId: params.recordingId,
          model: transcription.model,
        },
      });

      return transcription;
    },

    /**
     * 録画に対応する文字起こし結果を取得する。
     */
    async getByRecordingId(
      recordingId: string,
      organizationId: string,
    ): Promise<TranscriptionRow> {
      const result = await repo.findByRecordingId(recordingId, organizationId);
      if (!result) {
        throw new NotFoundError("Transcription", recordingId);
      }
      return result;
    },

    /**
     * 文字起こしを削除する（再実行のため）。
     */
    async deleteByRecordingId(
      recordingId: string,
      organizationId: string,
    ): Promise<void> {
      await repo.deleteByRecordingId(recordingId, organizationId);
    },
  };
}
