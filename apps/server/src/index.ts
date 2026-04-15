import { AwsClient } from "aws4fetch";
import app from "./app";
import { createRecordingRepository } from "./infrastructure/repositories/recording.repository";
import type { AppEnv } from "./types";

type VideoProcessingMessage = {
  recordingId: string;
  organizationId: string;
  r2Key: string;
};

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<VideoProcessingMessage>,
    env: AppEnv["Bindings"],
  ): Promise<void> {
    const repo = createRecordingRepository(env.DB);
    const aws = new AwsClient({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      service: "lambda",
      region: env.LAMBDA_REGION,
    });

    for (const msg of batch.messages) {
      const { recordingId, organizationId, r2Key } = msg.body;

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
