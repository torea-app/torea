import type { DriveExportKind } from "../../domain/types/google-drive";
import type { WebhookEventEnvelope } from "../../domain/types/webhook-events";
// dep-cruiser: use-cases-no-infrastructure-impl により infrastructure/ (repositories 以外) は
// type import のみ。具体実装は index.ts の queue handler で DI 経由で渡す。
import type {
  DriveClient,
  mapDriveError as mapDriveErrorFn,
} from "../../infrastructure/google-drive";
import type { DriveExportRepository } from "../../infrastructure/repositories/drive-export.repository";
import type { GoogleDriveAccountRepository } from "../../infrastructure/repositories/google-drive-account.repository";
import type { createRecordingRepository } from "../../infrastructure/repositories/recording.repository";
import type { createTranscriptionRepository } from "../../infrastructure/repositories/transcription.repository";

const MAX_RETRIES = 5;
const ROOT_FOLDER_NAME = "Torea";

/** R2 から必要な最小機能だけ抜き出す型 (実体は env.R2 をラップする)。 */
type R2Like = {
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
};

type Deps = {
  exportRepo: DriveExportRepository;
  driveAccountRepo: GoogleDriveAccountRepository;
  recordingRepo: ReturnType<typeof createRecordingRepository>;
  transcriptionRepo: ReturnType<typeof createTranscriptionRepository>;
  r2: R2Like;
  /** factory: userId → DriveClient (token provider 含めて構築済み) */
  buildDriveClient: (userId: string) => DriveClient;
  mapError: typeof mapDriveErrorFn;
  generateId: () => string;
  onEvent?: (envelope: WebhookEventEnvelope) => Promise<void>;
};

export type DriveExportRunResult = {
  /** true なら Cloudflare Queues 側で retry させる */
  retryable: boolean;
};

export type DriveExportRunner = ReturnType<typeof createDriveExportRunner>;

/**
 * `drive-export-queue` の 1 メッセージを処理する Runner。
 *
 * - `driveExport` 行を取得 → R2 から動画 / DB から transcript を読み出し
 * - `Torea/{title}-{id}/` フォルダ構造を find-or-create
 * - resumable upload (video) / multipart upload (transcript) で Drive へ送信
 * - 成功 → setCompleted + drive_exported Webhook
 * - 失敗 → mapError で分類し、retryable なら incrementRetryCount + msg.retry()、
 *          retry 上限に達したら setFailed + drive_export_failed Webhook
 */
export function createDriveExportRunner(deps: Deps) {
  return {
    async run(params: { exportId: string }): Promise<DriveExportRunResult> {
      const exp = await deps.exportRepo.findById(params.exportId);
      if (!exp) return { retryable: false }; // 行が消えているなら ack

      const rec = await deps.recordingRepo.findById(
        exp.recordingId,
        exp.organizationId,
      );
      if (!rec) {
        await deps.exportRepo.setFailed(exp.id, {
          errorCode: "UNKNOWN",
          errorMessage: "Recording not found",
          retryCount: exp.retryCount,
        });
        return { retryable: false };
      }

      // 録画作成者と connectedAccountUserId が乖離していれば失敗させる
      // (組織を抜けた等のケース)。
      if (rec.userId !== exp.connectedAccountUserId) {
        await deps.exportRepo.setFailed(exp.id, {
          errorCode: "UNKNOWN",
          errorMessage: "Recording owner mismatch",
          retryCount: exp.retryCount,
        });
        await emitFailed(deps, exp, rec, "UNKNOWN", "Recording owner mismatch");
        return { retryable: false };
      }

      const acc = await deps.driveAccountRepo.findByUserId(
        exp.connectedAccountUserId,
      );
      if (!acc || acc.status !== "active") {
        await deps.exportRepo.setFailed(exp.id, {
          errorCode: "TOKEN_REVOKED",
          errorMessage: "Drive 連携が解除されています",
          retryCount: exp.retryCount,
        });
        await emitFailed(
          deps,
          exp,
          rec,
          "TOKEN_REVOKED",
          "Drive 連携が解除されています",
        );
        return { retryable: false };
      }

      const drive = deps.buildDriveClient(exp.connectedAccountUserId);

      try {
        // root + recording-specific folder
        const rootId =
          acc.rootFolderId ??
          (await drive.findOrCreateFolder({ name: ROOT_FOLDER_NAME }));
        if (!acc.rootFolderId) {
          await deps.driveAccountRepo.setRootFolderId(acc.userId, rootId);
        }
        const subFolderName = `${sanitizeName(rec.title)}-${rec.id}`;
        const subFolderId = await drive.findOrCreateFolder({
          name: subFolderName,
          parentId: rootId,
        });

        if (exp.kind === "video") {
          await runVideoUpload({ deps, exp, rec, drive, subFolderId });
        } else {
          await runTranscriptUpload({ deps, exp, rec, drive, subFolderId });
        }
        return { retryable: false };
      } catch (err) {
        const mapped = deps.mapError(err);
        if (mapped.retryable && exp.retryCount + 1 < MAX_RETRIES) {
          await deps.exportRepo.incrementRetryCount(exp.id);
          return { retryable: true };
        }
        await deps.exportRepo.setFailed(exp.id, {
          errorCode: mapped.errorCode,
          errorMessage: mapped.errorMessage,
          retryCount: exp.retryCount,
        });
        await emitFailed(deps, exp, rec, mapped.errorCode, mapped.errorMessage);
        return { retryable: false };
      }
    },
  };
}

async function runVideoUpload(args: {
  deps: Deps;
  exp: {
    id: string;
    kind: DriveExportKind;
    recordingId: string;
    organizationId: string;
  };
  rec: {
    id: string;
    title: string;
    organizationId: string;
    r2Key: string;
    mimeType: string;
  };
  drive: DriveClient;
  subFolderId: string;
}) {
  const obj = await args.deps.r2.get(args.rec.r2Key);
  if (!obj) throw new Error("R2 object missing");
  await args.deps.exportRepo.setUploading(args.exp.id, {
    bytesTotal: obj.size,
  });

  const ext = args.rec.mimeType === "video/mp4" ? "mp4" : "webm";
  const sessionUri = await args.drive.createResumableUploadSession({
    name: `video.${ext}`,
    parentId: args.subFolderId,
    mimeType: args.rec.mimeType,
    contentLength: obj.size,
  });
  const file = await args.drive.putUploadBody({
    sessionUri,
    body: obj.body,
    contentType: args.rec.mimeType,
    contentLength: obj.size,
  });
  await args.deps.exportRepo.setCompleted(args.exp.id, {
    driveFileId: file.id,
    webViewLink: file.webViewLink ?? "",
    bytes: obj.size,
  });
  await emitCompleted(args.deps, args.exp, args.rec, file);
}

async function runTranscriptUpload(args: {
  deps: Deps;
  exp: {
    id: string;
    kind: DriveExportKind;
    recordingId: string;
    organizationId: string;
  };
  rec: { id: string; title: string; organizationId: string };
  drive: DriveClient;
  subFolderId: string;
}) {
  const tr = await args.deps.transcriptionRepo.findByRecordingId(
    args.rec.id,
    args.rec.organizationId,
  );
  if (!tr || tr.status !== "completed" || !tr.fullText) {
    await args.deps.exportRepo.setFailed(args.exp.id, {
      errorCode: "UNKNOWN",
      errorMessage: "Transcript not ready",
      retryCount: 0,
    });
    return;
  }
  const bytes = new TextEncoder().encode(tr.fullText).byteLength;
  await args.deps.exportRepo.setUploading(args.exp.id, { bytesTotal: bytes });
  const file = await args.drive.uploadSmallText({
    name: "transcript.txt",
    parentId: args.subFolderId,
    mimeType: "text/plain; charset=UTF-8",
    text: tr.fullText,
  });
  await args.deps.exportRepo.setCompleted(args.exp.id, {
    driveFileId: file.id,
    webViewLink: file.webViewLink ?? "",
    bytes,
  });
  await emitCompleted(args.deps, args.exp, args.rec, file);
}

/**
 * Drive サブフォルダ名に使うため、パス区切りや連続空白を正規化する。
 * 80 文字でトリム (Drive 自体は最大 32k だが UI 視認性のため)。
 */
function sanitizeName(s: string): string {
  return (
    s.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) ||
    "untitled"
  );
}

async function emitCompleted(
  deps: Deps,
  exp: {
    id: string;
    kind: DriveExportKind;
    recordingId: string;
    organizationId: string;
  },
  rec: { id: string; organizationId: string },
  file: { id: string; webViewLink?: string },
) {
  if (!deps.onEvent) return;
  try {
    await deps.onEvent({
      id: deps.generateId(),
      name: "recording.drive_exported",
      version: "v1",
      createdAt: new Date().toISOString(),
      organizationId: rec.organizationId,
      payload: {
        recordingId: rec.id,
        kind: exp.kind,
        driveFileId: file.id,
        driveWebViewLink: file.webViewLink ?? "",
      },
    });
  } catch (err) {
    console.error("drive_exported emit failed", err);
  }
}

async function emitFailed(
  deps: Deps,
  exp: {
    id: string;
    kind: DriveExportKind;
    recordingId: string;
    organizationId: string;
  },
  rec: { id: string; organizationId: string },
  errorCode: string,
  errorMessage: string,
) {
  if (!deps.onEvent) return;
  try {
    await deps.onEvent({
      id: deps.generateId(),
      name: "recording.drive_export_failed",
      version: "v1",
      createdAt: new Date().toISOString(),
      organizationId: rec.organizationId,
      payload: {
        recordingId: rec.id,
        kind: exp.kind,
        errorCode,
        errorMessage,
      },
    });
  } catch (err) {
    console.error("drive_export_failed emit failed", err);
  }
}
