import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRoute } from "./auth.route";
import { fileRoute } from "./file.route";
import { oembedRoute } from "./oembed.route";
import { organizationRoute } from "./organization.route";
import { recordingRoute } from "./recording.route";
import { shareRoute } from "./share.route";
import { shareAccessRoute } from "./share-access.route";

export const routes = new Hono<AppEnv>()
  // Auth
  .route("/api/auth", authRoute)
  .route("/api/organizations", organizationRoute)
  .route("/api/recordings", recordingRoute)
  // Files
  .route("/api/files", fileRoute)
  // Shares (management, authenticated)
  .route("/api/shares", shareRoute)
  // Share public access (custom auth)
  .route("/api/share", shareAccessRoute)
  // oEmbed (public, no auth)
  .route("/api/oembed", oembedRoute);
