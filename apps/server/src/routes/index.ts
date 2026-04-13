import { Hono } from "hono";
import type { AppEnv } from "../types";
import { authRoute } from "./auth.route";
import { fileRoute } from "./file.route";
import { organizationRoute } from "./organization.route";

export const routes = new Hono<AppEnv>()
  // Auth
  .route("/api/auth", authRoute)
  .route("/api/organizations", organizationRoute)
  // Files
  .route("/api/files", fileRoute);
