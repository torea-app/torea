import { Hono } from "hono";
import { R2StorageClient } from "../infrastructure/storage/r2-client";
import type { AppEnv } from "../types";

export const fileRoute = new Hono<AppEnv>().get("/*", async (c) => {
  const key = c.req.path.replace("/api/files/", "");
  if (!key) {
    return c.json({ error: "Key is required" }, 400);
  }

  const storage = new R2StorageClient(c.env.R2);
  const object = await storage.get(key);
  if (!object) {
    return c.json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream",
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});
