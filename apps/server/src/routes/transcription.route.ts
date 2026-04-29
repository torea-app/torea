import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createTranscriptionRepository } from "../infrastructure/repositories/transcription.repository";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createTranscriptionService } from "../use-cases/transcription/transcription.service";
import { buildWebhookEmitter } from "../webhook-emitter";
import { transcriptionParamSchema } from "./transcription.schemas";

export const transcriptionRoute = new Hono<AppEnv>()
  .use("/*", authMiddleware)
  .get(
    "/:id/transcription",
    requirePermission("captures", "read"),
    zValidator("param", transcriptionParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");
      const service = createTranscriptionService({
        repo: createTranscriptionRepository(c.env.DB),
        generateId: createId,
      });

      const transcription = await service.getByRecordingId(id, organizationId);

      // `transcription.segments` は DB に JSON 文字列として保存されており、
      // クライアントには配列形に展開して返す。Hono RPC は JSON.parse の戻り値を
      // any として推論するため、型注釈で形を確定させて web 側に正確な型を流す。
      const segments: Array<{
        start: number;
        end: number;
        text: string;
      }> | null = transcription.segments
        ? JSON.parse(transcription.segments)
        : null;

      return c.json({
        id: transcription.id,
        recordingId: transcription.recordingId,
        status: transcription.status,
        model: transcription.model,
        language: transcription.language,
        durationSeconds: transcription.durationSeconds,
        fullText: transcription.fullText,
        segments,
        errorMessage: transcription.errorMessage,
        createdAt: transcription.createdAt,
        completedAt: transcription.completedAt,
      });
    },
  )
  .post(
    "/:id/transcription",
    requirePermission("captures", "update"),
    zValidator("param", transcriptionParamSchema),
    async (c) => {
      const { id: recordingId } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");

      const recordingRepo = createRecordingRepository(c.env.DB);
      const recording = await recordingRepo.findById(
        recordingId,
        organizationId,
      );
      if (!recording) {
        return c.json({ error: "Recording not found" }, 404);
      }

      const emitter = buildWebhookEmitter(c.env);
      const service = createTranscriptionService({
        repo: createTranscriptionRepository(c.env.DB),
        generateId: createId,
        queue: c.env.TRANSCRIPTION_QUEUE,
        skipTranscription: c.env.SKIP_TRANSCRIPTION === "true",
        onEvent: emitter.emit,
      });

      const transcription = await service.enqueue({
        recordingId,
        organizationId,
        r2Key: recording.r2Key,
      });

      if (!transcription) {
        return c.json({ message: "Transcription is disabled" }, 200);
      }

      return c.json(
        { id: transcription.id, status: transcription.status },
        201,
      );
    },
  )
  .delete(
    "/:id/transcription",
    requirePermission("captures", "delete"),
    zValidator("param", transcriptionParamSchema),
    async (c) => {
      const { id: recordingId } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");
      const service = createTranscriptionService({
        repo: createTranscriptionRepository(c.env.DB),
        generateId: createId,
      });

      await service.deleteByRecordingId(recordingId, organizationId);
      return c.body(null, 204);
    },
  );
