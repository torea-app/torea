import { createId } from "@paralleldrive/cuid2";
import { AwsClient } from "aws4fetch";
import app from "./app";
import { createRecordingRepository } from "./infrastructure/repositories/recording.repository";
import { createTranscriptionRepository } from "./infrastructure/repositories/transcription.repository";
import type { AppEnv } from "./types";

type VideoProcessingMessage = {
  type?: "video-processing";
  recordingId: string;
  organizationId: string;
  r2Key: string;
};

type TranscriptionMessage = {
  type: "transcription";
  transcriptionId: string;
  recordingId: string;
  organizationId: string;
  r2Key: string;
};

type QueueMessage = VideoProcessingMessage | TranscriptionMessage;

async function handleVideoProcessingMessage(
  body: VideoProcessingMessage,
  env: AppEnv["Bindings"],
  aws: AwsClient,
  repo: ReturnType<typeof createRecordingRepository>,
) {
  const { recordingId, organizationId, r2Key } = body;

  try {
    const processUrl = new URL("/process", env.LAMBDA_FUNCTION_URL).href;
    const res = await aws.fetch(processUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ r2Key }),
    });

    if (res.ok) {
      await repo.updateStatus(recordingId, organizationId, {
        status: "completed",
        completedAt: new Date(),
      });
    } else {
      const errorBody = await res.text();
      console.error(
        `Video processing failed for ${recordingId}: ${res.status} ${errorBody}`,
      );
      // 変換失敗時は completed にして fMP4 のまま配信
      await repo.updateStatus(recordingId, organizationId, {
        status: "completed",
        completedAt: new Date(),
      });
    }
  } catch (err) {
    console.error(`Video processing error for ${recordingId}:`, err);
    // エラー時も completed にして fMP4 のまま配信
    await repo.updateStatus(recordingId, organizationId, {
      status: "completed",
      completedAt: new Date(),
    });
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
          type: "transcription" as const,
          transcriptionId: transcription.id,
          recordingId,
          organizationId,
          r2Key,
        });
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
  const { transcriptionId, recordingId, r2Key } = body;

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Transcription failed for ${recordingId}:`, message);

    await repo.updateStatus(transcriptionId, {
      status: "failed",
      errorMessage: message,
    });
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

    for (const msg of batch.messages) {
      const body = msg.body;

      if (body.type === "transcription") {
        await handleTranscriptionMessage(body, env, aws, transcriptionRepo);
      } else {
        await handleVideoProcessingMessage(body, env, aws, recordingRepo);
      }

      msg.ack();
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    _env: AppEnv["Bindings"],
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Reserved for future scheduled jobs
  },
};

export type { AppType } from "./app";
