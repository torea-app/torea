import { createId } from "@paralleldrive/cuid2";
import { AwsClient } from "aws4fetch";
import app from "./app";
import { createTokenProvider } from "./infrastructure/google-drive/authed-drive-client";
import { createDriveClient } from "./infrastructure/google-drive/drive-client";
import { mapDriveError } from "./infrastructure/google-drive/error-mapping";
import { createGoogleOAuthClient } from "./infrastructure/google-drive/oauth-client";
import { createDriveExportRepository } from "./infrastructure/repositories/drive-export.repository";
import { createGoogleDriveAccountRepository } from "./infrastructure/repositories/google-drive-account.repository";
import { createRecordingRepository } from "./infrastructure/repositories/recording.repository";
import { createTranscriptionRepository } from "./infrastructure/repositories/transcription.repository";
import { createUserIntegrationPreferenceRepository } from "./infrastructure/repositories/user-integration-preference.repository";
import { createWebhookRepository } from "./infrastructure/repositories/webhook.repository";
import { dispatchWebhook } from "./infrastructure/webhook/dispatcher";
import { createWebhookSecretStore } from "./infrastructure/webhook/secret-store";
import type { AppEnv } from "./types";
import { createDriveExportService } from "./use-cases/google-drive/drive-export.service";
import { createDriveExportRunner } from "./use-cases/google-drive/drive-export-runner.service";
import { createWebhookDeliveryRunner } from "./use-cases/webhook/webhook-delivery-runner.service";
import { createWebhookRetryScheduler } from "./use-cases/webhook/webhook-retry-scheduler.service";
import { buildWebhookEmitter } from "./webhook-emitter";

type VideoProcessingMessage = {
  recordingId: string;
  organizationId: string;
  r2Key: string;
};

type TranscriptionMessage = {
  transcriptionId: string;
  recordingId: string;
  organizationId: string;
  r2Key: string;
};

type WebhookDeliveryMessage = {
  deliveryId: string;
  organizationId: string;
};

type DriveExportMessage = {
  exportId: string;
  recordingId: string;
  organizationId: string;
};

type QueueMessage =
  | VideoProcessingMessage
  | TranscriptionMessage
  | WebhookDeliveryMessage
  | DriveExportMessage;

async function handleVideoProcessingMessage(
  body: VideoProcessingMessage,
  env: AppEnv["Bindings"],
  aws: AwsClient,
  repo: ReturnType<typeof createRecordingRepository>,
) {
  const { recordingId, organizationId, r2Key } = body;
  const emitter = buildWebhookEmitter(env);
  let lambdaSucceeded = false;
  let errorMessage: string | null = null;

  try {
    const processUrl = new URL("/process", env.LAMBDA_FUNCTION_URL).href;
    const res = await aws.fetch(processUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2Key }),
    });

    if (res.ok) {
      lambdaSucceeded = true;
      await repo.updateStatus(recordingId, organizationId, {
        status: "completed",
        completedAt: new Date(),
      });
    } else {
      errorMessage = `Lambda HTTP ${res.status}: ${await res.text()}`;
      console.error(
        `Video processing failed for ${recordingId}: ${errorMessage}`,
      );
      // 最適化失敗: unoptimized にして再生不可扱いとする
      await repo.updateStatus(recordingId, organizationId, {
        status: "unoptimized",
        completedAt: new Date(),
      });
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Video processing error for ${recordingId}:`, err);
    // 最適化失敗: unoptimized にして再生不可扱いとする
    await repo.updateStatus(recordingId, organizationId, {
      status: "unoptimized",
      completedAt: new Date(),
    });
  }

  // 成否にかかわらず最新状態で webhook を発火
  try {
    const latest = await repo.findById(recordingId, organizationId);
    if (latest) {
      if (lambdaSucceeded) {
        await emitter.emit({
          id: createId(),
          name: "recording.completed",
          version: "v1",
          createdAt: new Date().toISOString(),
          organizationId,
          payload: {
            recordingId: latest.id,
            title: latest.title,
            durationMs: latest.durationMs,
            fileSize: latest.fileSize,
            completedAt: (latest.completedAt ?? new Date()).toISOString(),
            thumbnailAvailable: Boolean(latest.thumbnailR2Key),
          },
        });
      } else {
        await emitter.emit({
          id: createId(),
          name: "recording.failed",
          version: "v1",
          createdAt: new Date().toISOString(),
          organizationId,
          payload: {
            recordingId: latest.id,
            errorCode: "LAMBDA_PROCESSING_FAILED",
            errorMessage: errorMessage ?? "Unknown error",
          },
        });
      }
    }
  } catch (emitErr) {
    console.error(
      `Failed to emit recording webhook for ${recordingId}:`,
      emitErr,
    );
  }

  // 動画変換完了後に文字起こしジョブをエンキュー（Lambda 失敗時はスキップ）
  if (lambdaSucceeded && env.SKIP_TRANSCRIPTION !== "true") {
    try {
      const transcriptionRepo = createTranscriptionRepository(env.DB);

      const existing = await transcriptionRepo.findByRecordingId(
        recordingId,
        organizationId,
      );
      if (!existing) {
        const transcription = await transcriptionRepo.create({
          id: createId(),
          recordingId,
          organizationId,
          status: "pending",
          model: "whisper-large-v3-turbo",
        });

        await env.TRANSCRIPTION_QUEUE.send({
          transcriptionId: transcription.id,
          recordingId,
          organizationId,
          r2Key,
        });

        // transcription.started 発火
        try {
          await emitter.emit({
            id: createId(),
            name: "transcription.started",
            version: "v1",
            createdAt: new Date().toISOString(),
            organizationId,
            payload: {
              transcriptionId: transcription.id,
              recordingId,
              model: transcription.model,
            },
          });
        } catch (emitErr) {
          console.error(
            `Failed to emit transcription.started for ${recordingId}:`,
            emitErr,
          );
        }
      }
    } catch (err) {
      console.error(`Failed to enqueue transcription for ${recordingId}:`, err);
      // 文字起こしエンキュー失敗は動画変換の成否に影響しない
    }
  }

  // 動画変換成功後に Drive 自動保存をトリガする (video のみ)。
  // transcript は transcription.completed 側で別途トリガする。
  if (lambdaSucceeded && env.SKIP_DRIVE_EXPORT !== "true") {
    try {
      const service = createDriveExportService({
        driveAccountRepo: createGoogleDriveAccountRepository(env.DB),
        exportRepo: createDriveExportRepository(env.DB),
        recordingRepo: createRecordingRepository(env.DB),
        transcriptionRepo: createTranscriptionRepository(env.DB),
        preferenceRepo: createUserIntegrationPreferenceRepository(env.DB),
        queue: env.DRIVE_EXPORT_QUEUE,
        generateId: createId,
      });
      await service.requestAutoExport({
        recordingId,
        organizationId,
        kinds: ["video"],
      });
    } catch (err) {
      console.error(
        `auto drive-export (video) skipped for ${recordingId}:`,
        err,
      );
    }
  }
}

async function handleTranscriptionMessage(
  body: TranscriptionMessage,
  env: AppEnv["Bindings"],
  aws: AwsClient,
  repo: ReturnType<typeof createTranscriptionRepository>,
) {
  const { transcriptionId, recordingId, organizationId, r2Key } = body;
  const emitter = buildWebhookEmitter(env);

  try {
    // status を processing に更新
    await repo.updateStatus(transcriptionId, {
      status: "processing",
      startedAt: new Date(),
    });

    // Lambda /transcribe を呼び出し
    const transcribeUrl = new URL("/transcribe", env.LAMBDA_FUNCTION_URL).href;
    const res = await aws.fetch(transcribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2Key, recordingId, language: "ja" }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Lambda returned ${res.status}: ${errorBody}`);
    }

    const result = await res.json<{
      success: boolean;
      fullText: string;
      segments: Array<{ start: number; end: number; text: string }>;
      language: string;
      duration: number;
      model: string;
      error?: string;
    }>();

    if (!result.success) {
      throw new Error(result.error ?? "Transcription failed");
    }

    // 結果を DB に保存
    await repo.updateStatus(transcriptionId, {
      status: "completed",
      fullText: result.fullText,
      segments: JSON.stringify(result.segments),
      language: result.language,
      durationSeconds: result.duration,
      model: result.model,
      completedAt: new Date(),
    });

    try {
      await emitter.emit({
        id: createId(),
        name: "transcription.completed",
        version: "v1",
        createdAt: new Date().toISOString(),
        organizationId,
        payload: {
          transcriptionId,
          recordingId,
          language: result.language ?? null,
          durationSeconds: result.duration ?? null,
          textPreview: (result.fullText ?? "").slice(0, 240),
        },
      });
    } catch (emitErr) {
      console.error(
        `Failed to emit transcription.completed for ${recordingId}:`,
        emitErr,
      );
    }

    // transcription 完了後に Drive 自動保存をトリガする (transcript のみ)。
    // video は recording.completed 側で既にトリガ済み。
    if (env.SKIP_DRIVE_EXPORT !== "true") {
      try {
        const service = createDriveExportService({
          driveAccountRepo: createGoogleDriveAccountRepository(env.DB),
          exportRepo: createDriveExportRepository(env.DB),
          recordingRepo: createRecordingRepository(env.DB),
          transcriptionRepo: createTranscriptionRepository(env.DB),
          preferenceRepo: createUserIntegrationPreferenceRepository(env.DB),
          queue: env.DRIVE_EXPORT_QUEUE,
          generateId: createId,
        });
        await service.requestAutoExport({
          recordingId,
          organizationId,
          kinds: ["transcript"],
        });
      } catch (err) {
        console.error(
          `auto drive-export (transcript) skipped for ${recordingId}:`,
          err,
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Transcription failed for ${recordingId}:`, message);

    await repo.updateStatus(transcriptionId, {
      status: "failed",
      errorMessage: message,
    });

    try {
      await emitter.emit({
        id: createId(),
        name: "transcription.failed",
        version: "v1",
        createdAt: new Date().toISOString(),
        organizationId,
        payload: {
          transcriptionId,
          recordingId,
          errorMessage: message,
        },
      });
    } catch (emitErr) {
      console.error(
        `Failed to emit transcription.failed for ${recordingId}:`,
        emitErr,
      );
    }
  }
}

async function handleWebhookDeliveryMessage(
  body: WebhookDeliveryMessage,
  env: AppEnv["Bindings"],
): Promise<void> {
  const runner = createWebhookDeliveryRunner({
    repo: createWebhookRepository(env.DB),
    secretStore: createWebhookSecretStore(env.WEBHOOK_SECRET_KV),
    queue: env.WEBHOOK_DELIVERY_QUEUE,
    dispatch: dispatchWebhook,
    now: () => new Date(),
  });
  await runner.run(body.deliveryId, body.organizationId);
}

async function handleDriveExportMessage(
  body: DriveExportMessage,
  env: AppEnv["Bindings"],
  msg: Message<DriveExportMessage>,
): Promise<void> {
  const driveAccountRepo = createGoogleDriveAccountRepository(env.DB);
  const oauth = createGoogleOAuthClient({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
  const buildDriveClient = (userId: string) => {
    const getAccessToken = createTokenProvider(
      {
        repo: driveAccountRepo,
        oauth,
        encryptionKeyB64: env.INTEGRATION_ENCRYPTION_KEY,
      },
      userId,
    );
    return createDriveClient(getAccessToken);
  };

  const emitter = buildWebhookEmitter(env);
  const runner = createDriveExportRunner({
    exportRepo: createDriveExportRepository(env.DB),
    driveAccountRepo,
    recordingRepo: createRecordingRepository(env.DB),
    transcriptionRepo: createTranscriptionRepository(env.DB),
    r2: {
      get: async (key) => {
        const obj = await env.R2.get(key);
        return obj ? { body: obj.body, size: obj.size } : null;
      },
    },
    buildDriveClient,
    mapError: mapDriveError,
    generateId: createId,
    onEvent: emitter.emit,
  });

  const result = await runner.run({ exportId: body.exportId });
  if (result.retryable) {
    msg.retry();
  }
}

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<QueueMessage>,
    env: AppEnv["Bindings"],
  ): Promise<void> {
    const recordingRepo = createRecordingRepository(env.DB);
    const transcriptionRepo = createTranscriptionRepository(env.DB);

    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      service: "lambda",
      region: env.LAMBDA_REGION,
    });

    // Cloudflare Queues は同一 Worker に複数 Queue をバインドできる。
    // `batch.queue` (送信元キュー名) でディスパッチするのが公式推奨パターン。
    // https://developers.cloudflare.com/queues/reference/how-queues-works/#queues-consumers
    // キュー名は stage サフィックス込み (例: torea-video-processing-prod) で来るため、
    // alchemy.run.ts でリソースから解決した実名を bindings 経由で参照する。
    for (const msg of batch.messages) {
      try {
        if (batch.queue === env.VIDEO_PROCESSING_QUEUE_NAME) {
          await handleVideoProcessingMessage(
            msg.body as VideoProcessingMessage,
            env,
            aws,
            recordingRepo,
          );
        } else if (batch.queue === env.TRANSCRIPTION_QUEUE_NAME) {
          await handleTranscriptionMessage(
            msg.body as TranscriptionMessage,
            env,
            aws,
            transcriptionRepo,
          );
        } else if (batch.queue === env.WEBHOOK_DELIVERY_QUEUE_NAME) {
          await handleWebhookDeliveryMessage(
            msg.body as WebhookDeliveryMessage,
            env,
          );
        } else if (batch.queue === env.DRIVE_EXPORT_QUEUE_NAME) {
          await handleDriveExportMessage(
            msg.body as DriveExportMessage,
            env,
            msg as Message<DriveExportMessage>,
          );
        } else {
          // 未知のキュー: ack せず retry させ、可視化する。
          // バインディング設定ミスや stage 解決バグの早期検知用。
          console.error(`Unknown queue: ${batch.queue}`);
          msg.retry();
          continue;
        }
      } catch (err) {
        // webhook-delivery は runner 内で retry / dead 化を管理するため ack でよい。
        // video / transcription もリトライは Queue 設定に委ねる（msg.retry() を明示していないため ack される）。
        console.error("Queue handler failed", err);
      }

      msg.ack();
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    env: AppEnv["Bindings"],
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Webhook 配信のセーフティネット: Queue ロスト / デプロイ取りこぼしを救済する。
    // 10 分間隔で起動 (alchemy.run.ts の `crons` 設定参照)。
    try {
      const scheduler = createWebhookRetryScheduler({
        repo: createWebhookRepository(env.DB),
        queue: env.WEBHOOK_DELIVERY_QUEUE,
        now: () => new Date(),
      });
      const result = await scheduler.runOnce();
      if (result.rescheduled > 0) {
        console.log(
          `[webhook-retry] Rescheduled ${result.rescheduled} stalled deliveries`,
        );
      }
    } catch (err) {
      console.error("[webhook-retry] Scheduler failed:", err);
    }
  },
};

export type { AppType } from "./app";
