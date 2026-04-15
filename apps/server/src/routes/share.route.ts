import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createShareRepository } from "../infrastructure/repositories/share.repository";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createShareService } from "../use-cases/share/share.service";
import {
  createShareLinkSchema,
  deleteShareLinkParamSchema,
  listShareLinksQuerySchema,
} from "./share.schemas";

export const shareRoute = new Hono<AppEnv>()
  // 全エンドポイントに認証を適用
  .use("/*", authMiddleware)

  // =============================================
  // POST /api/shares — 共有リンク作成
  // =============================================
  .post(
    "/",
    requirePermission("captures", "create"),
    zValidator("json", createShareLinkSchema),
    async (c) => {
      const body = c.req.valid("json");
      const user = c.get("user");
      const organizationId = c.get("activeOrganizationId");

      const service = createShareService({
        repo: createShareRepository(c.env.DB),
        recordingRepo: createRecordingRepository(c.env.DB),
        generateId: createId,
      });

      const shareLink = await service.createShareLink({
        organizationId,
        createdByUserId: user.id,
        recordingId: body.recordingId,
        type: body.type,
        password:
          body.type === "password_protected" ? body.password : undefined,
      });

      if (!shareLink) {
        return c.json({ error: "Recording not found" }, 404);
      }

      // パスワードハッシュ・ソルトはレスポンスに含めない
      return c.json(
        {
          id: shareLink.id,
          recordingId: shareLink.recordingId,
          type: shareLink.type,
          createdAt: shareLink.createdAt,
        },
        201,
      );
    },
  )

  // =============================================
  // GET /api/shares?recordingId=:id — 共有リンク一覧
  // =============================================
  .get(
    "/",
    requirePermission("captures", "read"),
    zValidator("query", listShareLinksQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const organizationId = c.get("activeOrganizationId");

      const service = createShareService({
        repo: createShareRepository(c.env.DB),
        recordingRepo: createRecordingRepository(c.env.DB),
        generateId: createId,
      });

      const shareLinks = await service.listShareLinks({
        organizationId,
        recordingId: query.recordingId,
      });

      // パスワードハッシュ・ソルトはレスポンスに含めない
      return c.json({
        shareLinks: shareLinks.map((link) => ({
          id: link.id,
          recordingId: link.recordingId,
          type: link.type,
          createdAt: link.createdAt,
        })),
      });
    },
  )

  // =============================================
  // DELETE /api/shares/:shareId — 共有リンク削除
  // =============================================
  .delete(
    "/:shareId",
    requirePermission("captures", "delete"),
    zValidator("param", deleteShareLinkParamSchema),
    async (c) => {
      const { shareId } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");

      const service = createShareService({
        repo: createShareRepository(c.env.DB),
        recordingRepo: createRecordingRepository(c.env.DB),
        generateId: createId,
      });

      const deleted = await service.deleteShareLink({
        organizationId,
        shareId,
      });

      if (!deleted) {
        // セキュリティ: 404 で応答（存在確認を防ぐ）
        return c.json({ error: "Share link not found" }, 404);
      }

      return c.body(null, 204);
    },
  );
