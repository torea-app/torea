import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { exportRecordingParamSchema } from "@torea/shared/schemas";
import { Hono } from "hono";
import { createDriveExportRepository } from "../infrastructure/repositories/drive-export.repository";
import { createGoogleDriveAccountRepository } from "../infrastructure/repositories/google-drive-account.repository";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createTranscriptionRepository } from "../infrastructure/repositories/transcription.repository";
import { createUserIntegrationPreferenceRepository } from "../infrastructure/repositories/user-integration-preference.repository";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createDriveExportService } from "../use-cases/google-drive/drive-export.service";

/**
 * 録画 1 件分の Drive エクスポートを管理する API。
 *
 * recording.route.ts と同じ `/api/recordings` プレフィックスにマウントすることで、
 * recording 機能のサブリソースとして見える URL 構造になる。
 */
function buildService(env: AppEnv["Bindings"]) {
  return createDriveExportService({
    driveAccountRepo: createGoogleDriveAccountRepository(env.DB),
    exportRepo: createDriveExportRepository(env.DB),
    recordingRepo: createRecordingRepository(env.DB),
    transcriptionRepo: createTranscriptionRepository(env.DB),
    preferenceRepo: createUserIntegrationPreferenceRepository(env.DB),
    queue: env.DRIVE_EXPORT_QUEUE,
    generateId: createId,
  });
}

export const driveExportRoute = new Hono<AppEnv>()
  .use("/*", authMiddleware)

  // ===========================================================================
  // POST /api/recordings/:id/drive-export — 手動エクスポート
  // ===========================================================================
  .post(
    "/:id/drive-export",
    requirePermission("captures", "read"),
    zValidator("param", exportRecordingParamSchema),
    async (c) => {
      const { id: recordingId } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");
      const result = await buildService(c.env).requestExport({
        recordingId,
        organizationId,
        triggeredBy: "manual",
      });
      return c.json(result, 201);
    },
  )

  // ===========================================================================
  // GET /api/recordings/:id/drive-export — 状態取得
  // ===========================================================================
  .get(
    "/:id/drive-export",
    requirePermission("captures", "read"),
    zValidator("param", exportRecordingParamSchema),
    async (c) => {
      const { id: recordingId } = c.req.valid("param");
      const organizationId = c.get("activeOrganizationId");
      const exports = await buildService(c.env).listExports({
        recordingId,
        organizationId,
      });
      return c.json({ exports });
    },
  );
