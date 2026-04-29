import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRoute } from "./auth.route";
import { billingRoute } from "./billing.route";
import { dashboardRoute } from "./dashboard.route";
import { driveExportRoute } from "./drive-export.route";
import { fileRoute } from "./file.route";
import { googleDriveRoute } from "./google-drive.route";
import { oembedRoute } from "./oembed.route";
import { organizationRoute } from "./organization.route";
import { recordingRoute } from "./recording.route";
import { shareRoute } from "./share.route";
import { shareAccessRoute } from "./share-access.route";
import { transcriptionRoute } from "./transcription.route";
import { webhookRoute } from "./webhook.route";

export const routes = new Hono<AppEnv>()
  // Auth
  .route("/api/auth", authRoute)
  .route("/api/organizations", organizationRoute)
  .route("/api/dashboard", dashboardRoute)
  .route("/api/recordings", recordingRoute)
  // Transcription (under /api/recordings/:id/transcription)
  .route("/api/recordings", transcriptionRoute)
  // Drive export (under /api/recordings/:id/drive-export)
  .route("/api/recordings", driveExportRoute)
  // Files
  .route("/api/files", fileRoute)
  // Shares (management, authenticated)
  .route("/api/shares", shareRoute)
  // Share public access (custom auth)
  .route("/api/share", shareAccessRoute)
  // oEmbed (public, no auth)
  .route("/api/oembed", oembedRoute)
  // Webhook management (owner/admin のみ)
  .route("/api/webhooks", webhookRoute)
  // Google Drive 連携
  .route("/api/integrations/google-drive", googleDriveRoute)
  // Billing (current plan + monthly usage)
  .route("/api/billing", billingRoute);
