import { NotFoundError } from "../../domain/errors/domain.error";
import type {
  createTranscriptionRepository,
  TranscriptionRow,
} from "../../infrastructure/repositories/transcription.repository";

type Deps = {
  repo: ReturnType<typeof createTranscriptionRepository>;
  generateId: () => string;
  queue?: Queue;
  skipTranscription?: boolean;
};

export function createTranscriptionService({
  repo,
  generateId,
  queue,
  skipTranscription,
}: Deps) {
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
