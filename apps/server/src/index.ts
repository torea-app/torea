import { createId } from "@paralleldrive/cuid2";
import { AwsClient } from "aws4fetch";
import app from "./app";
import { createRecordingRepository } from "./infrastructure/repositories/recording.repository";
import { createTranscriptionRepository } from "./infrastructure/repositories/transcription.repository";
import { createWebhookRepository } from "./infrastructure/repositories/webhook.repository";
import { dispatchWebhook } from "./infrastructure/webhook/dispatcher";
import { createWebhookSecretStore } from "./infrastructure/webhook/secret-store";
import type { AppEnv } from "./types";
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

type QueueMessage =
  | VideoProcessingMessage
  | TranscriptionMessage
  | WebhookDeliveryMessage;

// alchemy.run.ts の Queue({ name: ... }) と一致させる
const QUEUE_VIDEO_PROCESSING = "torea-video-processing";
const QUEUE_TRANSCRIPTION = "torea-transcription";
const QUEUE_WEBHOOK_DELIVERY = "torea-webhook-delivery";

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
      // 変換失敗時は completed にして fMP4 のまま配信
      await repo.updateStatus(recordingId, organizationId, {
        status: "completed",
        completedAt: new Date(),
      });
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Video processing error for ${recordingId}:`, err);
    // エラー時も completed にして fMP4 のまま配信
    await repo.updateStatus(recordingId, organizationId, {
      status: "completed",
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

  // 動画変換完了後に文字起こしジョブをエンキュー
  if (env.SKIP_TRANSCRIPTION !== "true") {
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
    for (const msg of batch.messages) {
      try {
        switch (batch.queue) {
          case QUEUE_TRANSCRIPTION:
            await handleTranscriptionMessage(
              msg.body as TranscriptionMessage,
              env,
              aws,
              transcriptionRepo,
            );
            break;
          case QUEUE_WEBHOOK_DELIVERY:
            await handleWebhookDeliveryMessage(
              msg.body as WebhookDeliveryMessage,
              env,
            );
            break;
          case QUEUE_VIDEO_PROCESSING:
            await handleVideoProcessingMessage(
              msg.body as VideoProcessingMessage,
              env,
              aws,
              recordingRepo,
            );
            break;
          default:
            console.error(`Unknown queue: ${batch.queue}`);
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
