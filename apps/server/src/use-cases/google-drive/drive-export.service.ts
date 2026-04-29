import {
  NotFoundError,
  ValidationError,
} from "../../domain/errors/domain.error";
import {
  DriveNotConnectedError,
  DriveTokenRevokedError,
} from "../../domain/errors/drive.error";
import type {
  DriveExportKind,
  DriveExportTriggeredBy,
} from "../../domain/types/google-drive";
import type { DriveExportRepository } from "../../infrastructure/repositories/drive-export.repository";
import type { GoogleDriveAccountRepository } from "../../infrastructure/repositories/google-drive-account.repository";
import type { createRecordingRepository } from "../../infrastructure/repositories/recording.repository";
import type { createTranscriptionRepository } from "../../infrastructure/repositories/transcription.repository";
import type { UserIntegrationPreferenceRepository } from "../../infrastructure/repositories/user-integration-preference.repository";

/** 5 GB safety guard。Drive 仕様上はもっと送れるが、Worker subrequest 経路で安全な上限。 */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;

type QueueClient = {
  send(message: {
    exportId: string;
    recordingId: string;
    organizationId: string;
  }): Promise<void>;
};

type Deps = {
  driveAccountRepo: GoogleDriveAccountRepository;
  exportRepo: DriveExportRepository;
  recordingRepo: ReturnType<typeof createRecordingRepository>;
  transcriptionRepo: ReturnType<typeof createTranscriptionRepository>;
  preferenceRepo: UserIntegrationPreferenceRepository;
  queue: QueueClient;
  generateId: () => string;
};

type EnqueueResult = {
  exports: Array<{ kind: DriveExportKind; status: string }>;
};

export type DriveExportService = ReturnType<typeof createDriveExportService>;

export function createDriveExportService(deps: Deps) {
  async function ensureConnectedActive(userId: string) {
    const acc = await deps.driveAccountRepo.findByUserId(userId);
    if (!acc) throw new DriveNotConnectedError();
    if (acc.status !== "active") throw new DriveTokenRevokedError();
    return acc;
  }

  async function enqueueIfReady(params: {
    recordingId: string;
    organizationId: string;
    triggeredBy: DriveExportTriggeredBy;
    kinds: DriveExportKind[];
  }): Promise<EnqueueResult> {
    const rec = await deps.recordingRepo.findById(
      params.recordingId,
      params.organizationId,
    );
    if (!rec) throw new NotFoundError("Recording", params.recordingId);
    if (rec.status !== "completed") {
      throw new ValidationError("Recording is not completed yet");
    }
    if (rec.fileSize && rec.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError("File too large for Drive export");
    }
    // 連携トークンは録画作成者 (rec.userId) のものを使用する。
    // 同組織の他メンバーが「Drive に保存」を押しても、保存先は録画作成者の Drive。
    await ensureConnectedActive(rec.userId);

    const created: EnqueueResult["exports"] = [];

    if (params.kinds.includes("video")) {
      const row = await deps.exportRepo.upsertQueued({
        id: deps.generateId(),
        recordingId: rec.id,
        organizationId: rec.organizationId,
        connectedAccountUserId: rec.userId,
        kind: "video",
        triggeredBy: params.triggeredBy,
      });
      await deps.queue.send({
        exportId: row.id,
        recordingId: rec.id,
        organizationId: rec.organizationId,
      });
      created.push({ kind: "video", status: row.status });
    }

    // transcript は Whisper 完了済みのみ送信対象。
    if (params.kinds.includes("transcript")) {
      const tr = await deps.transcriptionRepo.findByRecordingId(
        rec.id,
        rec.organizationId,
      );
      if (tr && tr.status === "completed" && tr.fullText) {
        const row = await deps.exportRepo.upsertQueued({
          id: deps.generateId(),
          recordingId: rec.id,
          organizationId: rec.organizationId,
          connectedAccountUserId: rec.userId,
          kind: "transcript",
          triggeredBy: params.triggeredBy,
        });
        await deps.queue.send({
          exportId: row.id,
          recordingId: rec.id,
          organizationId: rec.organizationId,
        });
        created.push({ kind: "transcript", status: row.status });
      }
    }

    return { exports: created };
  }

  return {
    /**
     * 手動 / API 経由のリクエスト。常に video / transcript 両方を対象にする
     * (transcript は完了済みのときのみ実際に enqueue される)。
     */
    async requestExport(params: {
      recordingId: string;
      organizationId: string;
      triggeredBy: DriveExportTriggeredBy;
    }): Promise<EnqueueResult> {
      return enqueueIfReady({ ...params, kinds: ["video", "transcript"] });
    },

    /**
     * 自動保存トリガから呼ばれる。失敗しても呼び出し元処理は続行できる純関数。
     * 連携未設定 / autoSaveToDrive=false の場合は no-op。
     *
     * `kinds` は呼び出し側が決める:
     * - `recording.completed` フック: `["video"]`
     * - `transcription.completed` フック: `["transcript"]`
     *
     * これにより transcription 完了時に video が再エクスポートされるのを防ぐ。
     */
    async requestAutoExport(params: {
      recordingId: string;
      organizationId: string;
      kinds: DriveExportKind[];
    }): Promise<void> {
      try {
        const rec = await deps.recordingRepo.findById(
          params.recordingId,
          params.organizationId,
        );
        if (!rec || rec.status !== "completed") return;

        const pref = await deps.preferenceRepo.findByUserId(rec.userId);
        if (!pref?.autoSaveToDrive) return;

        const acc = await deps.driveAccountRepo.findByUserId(rec.userId);
        if (!acc || acc.status !== "active") return;

        await enqueueIfReady({
          recordingId: rec.id,
          organizationId: rec.organizationId,
          triggeredBy: "auto",
          kinds: params.kinds,
        });
      } catch (err) {
        console.error(
          `[drive-export] auto-export skipped for recording ${params.recordingId}:`,
          err,
        );
      }
    },

    /** 録画詳細の status 表示用 */
    async listExports(params: { recordingId: string; organizationId: string }) {
      const rows = await deps.exportRepo.findByRecordingId(
        params.recordingId,
        params.organizationId,
      );
      return rows.map((r) => ({
        kind: r.kind,
        status: r.status,
        triggeredBy: r.triggeredBy,
        driveWebViewLink: r.driveWebViewLink,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        bytesUploaded: r.bytesUploaded,
        bytesTotal: r.bytesTotal,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        retryCount: r.retryCount,
      }));
    },
  };
}
