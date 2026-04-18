import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRoute } from "./auth.route";
import { dashboardRoute } from "./dashboard.route";
import { fileRoute } from "./file.route";
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
  // Files
  .route("/api/files", fileRoute)
  // Shares (management, authenticated)
  .route("/api/shares", shareRoute)
  // Share public access (custom auth)
  .route("/api/share", shareAccessRoute)
  // oEmbed (public, no auth)
  .route("/api/oembed", oembedRoute)
  // Webhook management (owner/admin のみ)
  .route("/api/webhooks", webhookRoute);
