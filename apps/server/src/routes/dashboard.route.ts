import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createCommentRepository } from "../infrastructure/repositories/comment.repository";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createViewEventRepository } from "../infrastructure/repositories/view-event.repository";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createDashboardService } from "../use-cases/dashboard/dashboard.service";
import { overviewQuerySchema } from "./dashboard.schemas";

export const dashboardRoute = new Hono<AppEnv>()
  // 全エンドポイントに認証を適用
  .use("/*", authMiddleware)

  // =============================================
  // GET /api/dashboard/overview — ダッシュボード概要
  // =============================================
  .get(
    "/overview",
    requirePermission("captures", "read"),
    zValidator("query", overviewQuerySchema),
    async (c) => {
      const { period } = c.req.valid("query");
      const organizationId = c.get("activeOrganizationId");

      const service = createDashboardService({
        recordingRepo: createRecordingRepository(c.env.DB),
        viewEventRepo: createViewEventRepository(c.env.DB),
        commentRepo: createCommentRepository(c.env.DB),
      });

      const overview = await service.getOverview({
        organizationId,
        period,
      });

      return c.json(overview);
    },
  );
