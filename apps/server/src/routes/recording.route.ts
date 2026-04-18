import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { createCommentRepository } from "../infrastructure/repositories/comment.repository";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createViewEventRepository } from "../infrastructure/repositories/view-event.repository";
import { R2StorageClient } from "../infrastructure/storage/r2-client";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createCommentService } from "../use-cases/comment/comment.service";
import { createRecordingService } from "../use-cases/recording/recording.service";
import { createViewAnalyticsService } from "../use-cases/view-analytics/view-analytics.service";
import { buildWebhookEmitter } from "../webhook-emitter";
import { createCommentSchema, updateCommentSchema } from "./comment.schemas";
import {
  bulkDeleteRecordingsSchema,
  completeRecordingSchema,
  createRecordingSchema,
  listRecordingsSchema,
} from "./recording.schemas";

export const recordingRoute = new Hono<AppEnv>()
  // 全エンドポイントに認証を適用
  .use("/*", authMiddleware)

  // =============================================
  // POST /api/recordings — 録画開始
  // =============================================
  .post(
    "/",
    requirePermission("captures", "create"),
    zValidator("json", createRecordingSchema),
    async (c) => {
      const body = c.req.valid("json");
      const user = c.get("user");
      const organizationId = c.get("activeOrganizationId");

      const emitter = buildWebhookEmitter(c.env);
      const service = createRecordingService({
        repo: createRecordingRepository(c.env.DB),
        storage: new R2StorageClient(c.env.R2),
        generateId: createId,
        onEvent: emitter.emit,
      });

      const title =
        body.title ??
        `録画 ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;

      const result = await service.startRecording({
        organizationId,
        userId: user.id,
        title,
        mimeType: body.mimeType,
      });

      return c.json(
        {
          id: result.recording.id,
          uploadId: result.uploadId,
          r2Key: result.recording.r2Key,
        },
        201,
      );
    },
  )

  // =============================================
  // PUT /api/recordings/:id/parts/:partNumber — パートアップロード
  // =============================================
  .put(
    "/:id/parts/:partNumber",
    requirePermission("captures", "create"),
    async (c) => {
      const recordingId = c.req.param("id");
      const partNumber = Number.parseInt(c.req.param("partNumber"), 10);
      const organizationId = c.get("activeOrganizationId");

      if (Number.isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
        return c.json({ error: "Invalid part number (1-10000)" }, 400);
      }

      const body = c.req.raw.body;
      if (!body) {
        return c.json({ error: "Request body is required" }, 400);
      }

      const service = createRecordingService({
        repo: createRecordingRepository(c.env.DB),
        storage: new R2StorageClient(c.env.R2),
        generateId: createId,
      });

      const part = await service.uploadPart({
        recordingId,
        organizationId,
        partNumber,
        body,
      });

      return c.json(part);
    },
  )

  // =============================================
  // POST /api/recordings/:id/complete — 録画完了
  // =============================================
  .post(
    "/:id/complete",
    requirePermission("captures", "create"),
    zValidator("json", completeRecordingSchema),
    async (c) => {
      const recordingId = c.req.param("id");
      const body = c.req.valid("json");
      const organizationId = c.get("activeOrganizationId");

      const service = createRecordingService({
        repo: createRecordingRepository(c.env.DB),
        storage: new R2StorageClient(c.env.R2),
        generateId: createId,
        queue: c.env.VIDEO_PROCESSING_QUEUE,
        skipVideoProcessing: c.env.SKIP_VIDEO_PROCESSING === "true",
      });

      const recording = await service.completeRecording({
        recordingId,
        organizationId,
        parts: body.parts,
        durationMs: body.durationMs,
        fileSize: body.fileSize,
      });

      return c.json({ recording });
    },
  )

  // =============================================
  // POST /api/recordings/:id/abort — 録画中止
  // =============================================
  .post("/:id/abort", requirePermission("captures", "create"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    const service = createRecordingService({
      repo: createRecordingRepository(c.env.DB),
      storage: new R2StorageClient(c.env.R2),
      generateId: createId,
    });

    await service.abortRecording({ recordingId, organizationId });

    return c.json({ success: true });
  })

  // =============================================
  // GET /api/recordings — 一覧取得
  // =============================================
  .get(
    "/",
    requirePermission("captures", "read"),
    zValidator("query", listRecordingsSchema),
    async (c) => {
      const query = c.req.valid("query");
      const organizationId = c.get("activeOrganizationId");

      const service = createRecordingService({
        repo: createRecordingRepository(c.env.DB),
        storage: new R2StorageClient(c.env.R2),
        generateId: createId,
      });

      const result = await service.listRecordings({
        organizationId,
        limit: query.limit,
        offset: query.offset,
      });

      return c.json(result);
    },
  )

  // =============================================
  // POST /api/recordings/bulk-delete — 一括削除
  // =============================================
  .post(
    "/bulk-delete",
    requirePermission("captures", "delete"),
    zValidator("json", bulkDeleteRecordingsSchema),
    async (c) => {
      const { ids } = c.req.valid("json");
      const organizationId = c.get("activeOrganizationId");
      const user = c.get("user");

      const emitter = buildWebhookEmitter(c.env);
      const service = createRecordingService({
        repo: createRecordingRepository(c.env.DB),
        storage: new R2StorageClient(c.env.R2),
        generateId: createId,
        onEvent: emitter.emit,
      });

      const { deletedCount } = await service.deleteRecordings({
        recordingIds: ids,
        organizationId,
        deletedByUserId: user.id,
      });

      return c.json({ deletedCount });
    },
  )

  // =============================================
  // GET /api/recordings/:id — 詳細取得
  // =============================================
  .get("/:id", requirePermission("captures", "read"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    const service = createRecordingService({
      repo: createRecordingRepository(c.env.DB),
      storage: new R2StorageClient(c.env.R2),
      generateId: createId,
    });

    const recording = await service.getRecording({
      recordingId,
      organizationId,
    });

    if (!recording) {
      return c.json({ error: "Recording not found" }, 404);
    }

    return c.json({ recording });
  })

  // =============================================
  // GET /api/recordings/:id/stats — 視聴統計取得
  // =============================================
  .get("/:id/stats", requirePermission("captures", "read"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    // 録画の存在確認 + 組織スコープチェック
    const repo = createRecordingRepository(c.env.DB);
    const rec = await repo.findById(recordingId, organizationId);

    if (!rec) {
      return c.json({ error: "Recording not found" }, 404);
    }

    const service = createViewAnalyticsService({
      repo: createViewEventRepository(c.env.DB),
      generateId: createId,
    });

    const stats = await service.getStats(recordingId);

    return c.json(stats);
  })

  // =============================================
  // GET /api/recordings/:id/stream — 動画ストリーミング
  // =============================================
  .get("/:id/stream", requirePermission("captures", "read"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    const repo = createRecordingRepository(c.env.DB);
    const rec = await repo.findById(recordingId, organizationId);

    if (!rec) {
      return c.json({ error: "Recording not found" }, 404);
    }
    if (rec.status !== "completed" && rec.status !== "processing") {
      return c.json({ error: "Recording is not ready for playback" }, 400);
    }

    const storage = new R2StorageClient(c.env.R2);
    const etag = `"${recordingId}"`;

    // If-None-Match: ETag が一致すれば 304 を返す（R2 フェッチをスキップ）
    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control":
            "private, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    // Range header の解析
    const rangeHeader = c.req.header("range");
    let parsedStart: number | undefined;
    let parsedEnd: number | undefined;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match?.[1]) {
        parsedStart = Number.parseInt(match[1], 10);
        parsedEnd = match[2] ? Number.parseInt(match[2], 10) : undefined;
      }
    }

    // R2 Range パラメータを構築（length: undefined を渡さない）
    const r2Range =
      parsedStart !== undefined
        ? parsedEnd !== undefined
          ? { offset: parsedStart, length: parsedEnd - parsedStart + 1 }
          : { offset: parsedStart }
        : undefined;

    const object = r2Range
      ? await storage.getWithRange(rec.r2Key, r2Range)
      : await storage.get(rec.r2Key);

    if (!object) {
      return c.json({ error: "Video file not found in storage" }, 404);
    }

    const totalSize = object.size;
    const headers = new Headers();
    headers.set("Content-Type", rec.mimeType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("ETag", etag);
    headers.set(
      "Cache-Control",
      "private, max-age=3600, stale-while-revalidate=86400",
    );

    // Range リクエストの場合は常に 206 を返す
    if (r2Range) {
      const rangeStart = r2Range.offset;
      const rangeLength = object.range
        ? (object.range as { length: number }).length
        : parsedEnd !== undefined
          ? parsedEnd - rangeStart + 1
          : totalSize - rangeStart;
      const rangeEnd = rangeStart + rangeLength - 1;

      headers.set(
        "Content-Range",
        `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
      );
      headers.set("Content-Length", String(rangeLength));
      return new Response(object.body, { status: 206, headers });
    }

    headers.set("Content-Length", String(totalSize));
    return new Response(object.body, { status: 200, headers });
  })

  // =============================================
  // GET /api/recordings/:id/download — ダウンロード
  // =============================================
  .get("/:id/download", requirePermission("captures", "read"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    const repo = createRecordingRepository(c.env.DB);
    const rec = await repo.findById(recordingId, organizationId);

    if (!rec) {
      return c.json({ error: "Recording not found" }, 404);
    }
    if (rec.status !== "completed" && rec.status !== "processing") {
      return c.json({ error: "Recording is not ready for download" }, 400);
    }

    const storage = new R2StorageClient(c.env.R2);
    const object = await storage.get(rec.r2Key);

    if (!object) {
      return c.json({ error: "Video file not found in storage" }, 404);
    }

    const ext = rec.mimeType === "video/mp4" ? "mp4" : "webm";
    const filename = `${rec.title}.${ext}`;

    const headers = new Headers();
    headers.set("Content-Type", rec.mimeType);
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    headers.set("Content-Length", String(object.size));
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(object.body, { status: 200, headers });
  })

  // =============================================
  // DELETE /api/recordings/:id — 削除
  // =============================================
  .delete("/:id", requirePermission("captures", "delete"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");
    const user = c.get("user");

    const emitter = buildWebhookEmitter(c.env);
    const service = createRecordingService({
      repo: createRecordingRepository(c.env.DB),
      storage: new R2StorageClient(c.env.R2),
      generateId: createId,
      onEvent: emitter.emit,
    });

    await service.deleteRecording({
      recordingId,
      organizationId,
      deletedByUserId: user.id,
    });

    return c.body(null, 204);
  })

  // =============================================
  // POST /api/recordings/:id/thumbnail — サムネイルアップロード
  // =============================================
  .post("/:id/thumbnail", requirePermission("captures", "read"), async (c) => {
    const id = c.req.param("id");
    const orgId = c.get("activeOrganizationId");

    const recordingRepo = createRecordingRepository(c.env.DB);
    const rec = await recordingRepo.findById(id, orgId);
    if (!rec) {
      return c.json({ error: "Recording not found" }, 404);
    }

    const contentType = c.req.header("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      return c.json({ error: "Invalid content type" }, 400);
    }

    const body = await c.req.arrayBuffer();
    if (body.byteLength > 2 * 1024 * 1024) {
      return c.json({ error: "File too large" }, 400);
    }

    const r2Key = `recordings/${orgId}/${id}/thumbnail.webp`;
    const r2Client = new R2StorageClient(c.env.R2);
    await r2Client.upload(r2Key, body, contentType);

    await recordingRepo.updateThumbnail(id, orgId, r2Key);

    return c.json({ thumbnailR2Key: r2Key });
  })

  // =============================================
  // GET /api/recordings/:id/comments — コメント一覧取得
  // =============================================
  .get("/:id/comments", requirePermission("captures", "read"), async (c) => {
    const recordingId = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");

    // 録画の存在確認 + 組織スコープチェック
    const recordingRepo = createRecordingRepository(c.env.DB);
    const rec = await recordingRepo.findById(recordingId, organizationId);
    if (!rec) {
      return c.json({ error: "Recording not found" }, 404);
    }

    const service = createCommentService({
      repo: createCommentRepository(c.env.DB),
      generateId: createId,
    });

    const comments = await service.listComments(recordingId);
    return c.json({ comments });
  })

  // =============================================
  // POST /api/recordings/:id/comments — コメント作成
  // =============================================
  .post(
    "/:id/comments",
    requirePermission("captures", "read"),
    zValidator("json", createCommentSchema),
    async (c) => {
      const recordingId = c.req.param("id");
      const organizationId = c.get("activeOrganizationId");
      const userId = c.get("user").id;
      const body = c.req.valid("json");

      // 録画の存在確認 + 組織スコープチェック
      const recordingRepo = createRecordingRepository(c.env.DB);
      const rec = await recordingRepo.findById(recordingId, organizationId);
      if (!rec) {
        return c.json({ error: "Recording not found" }, 404);
      }

      const service = createCommentService({
        repo: createCommentRepository(c.env.DB),
        generateId: createId,
      });

      try {
        const comments = await service.createComment({
          recordingId,
          userId,
          body: body.body,
          timestampMs: body.timestampMs,
          parentId: body.parentId,
        });
        return c.json({ comments }, 201);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create comment";
        return c.json({ error: message }, 400);
      }
    },
  )

  // =============================================
  // PATCH /api/recordings/:id/comments/:commentId — コメント更新
  // =============================================
  .patch(
    "/:id/comments/:commentId",
    requirePermission("captures", "read"),
    zValidator("json", updateCommentSchema),
    async (c) => {
      const recordingId = c.req.param("id");
      const commentId = c.req.param("commentId");
      const organizationId = c.get("activeOrganizationId");
      const userId = c.get("user").id;
      const body = c.req.valid("json");

      // 録画の存在確認 + 組織スコープチェック
      const recordingRepo = createRecordingRepository(c.env.DB);
      const rec = await recordingRepo.findById(recordingId, organizationId);
      if (!rec) {
        return c.json({ error: "Recording not found" }, 404);
      }

      const service = createCommentService({
        repo: createCommentRepository(c.env.DB),
        generateId: createId,
      });

      try {
        await service.updateComment({
          commentId,
          userId,
          body: body.body,
        });
        return c.json({ success: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update comment";
        if (message === "Comment not found") {
          return c.json({ error: message }, 404);
        }
        if (message === "Not authorized to edit this comment") {
          return c.json({ error: message }, 403);
        }
        return c.json({ error: message }, 400);
      }
    },
  )

  // =============================================
  // DELETE /api/recordings/:id/comments/:commentId — コメント削除
  // =============================================
  .delete(
    "/:id/comments/:commentId",
    requirePermission("captures", "read"),
    async (c) => {
      const recordingId = c.req.param("id");
      const commentId = c.req.param("commentId");
      const organizationId = c.get("activeOrganizationId");
      const userId = c.get("user").id;

      // 録画の存在確認 + 組織スコープチェック
      const recordingRepo = createRecordingRepository(c.env.DB);
      const rec = await recordingRepo.findById(recordingId, organizationId);
      if (!rec) {
        return c.json({ error: "Recording not found" }, 404);
      }

      const service = createCommentService({
        repo: createCommentRepository(c.env.DB),
        generateId: createId,
      });

      try {
        await service.deleteComment({ commentId, userId });
        return c.body(null, 204);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete comment";
        if (message === "Comment not found") {
          return c.json({ error: message }, 404);
        }
        if (message === "Not authorized to delete this comment") {
          return c.json({ error: message }, 403);
        }
        return c.json({ error: message }, 400);
      }
    },
  );
