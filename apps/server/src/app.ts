import { env } from "@screenbase/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { DomainError } from "./domain/errors/domain.error";
import { routes } from "./routes";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>()
  .use(logger())
  .use(
    "/*",
    cors({
      origin: (origin) => {
        const allowed = env.CORS_ORIGIN.split(",").map((o) => o.trim());
        return allowed.includes(origin) ? origin : allowed[0];
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "Range"],
      exposeHeaders: [
        "Content-Range",
        "Accept-Ranges",
        "Content-Length",
        "ETag",
      ],
      maxAge: 3600,
      credentials: true,
    }),
  )
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/", routes)
  .onError((err, c) => {
    if (err instanceof DomainError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        PERMISSION_DENIED: 403,
        UNAUTHORIZED: 401,
        ALREADY_EXISTS: 409,
        VALIDATION_ERROR: 400,
      };
      const status = statusMap[err.code] ?? 400;
      return c.json(
        { error: err.message, code: err.code },
        status as 400 | 401 | 403 | 404 | 409,
      );
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

export default app;
export type AppType = typeof app;
