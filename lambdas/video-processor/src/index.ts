import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

const app = new Hono();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "";

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/process", async (c) => {
  const { r2Key } = await c.req.json<{ r2Key: string }>();

  const inputPath = "/tmp/input.mp4";
  const outputPath = "/tmp/output.mp4";

  try {
    // Download from R2
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }),
    );
    if (!getRes.Body) {
      return c.json({ error: "Failed to download from R2" }, 500);
    }

    const writeStream = createWriteStream(inputPath);
    // @ts-expect-error -- S3 Body is a Readable stream in Node.js
    await pipeline(getRes.Body, writeStream);

    // Run ffmpeg: remux to progressive MP4 (no re-encoding)
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    // Upload back to R2 (overwrite same key)
    const readStream = createReadStream(outputPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: readStream,
        ContentType: "video/mp4",
      }),
    );

    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Processing failed:", message);
    return c.json({ error: message }, 500);
  } finally {
    // Clean up temp files
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)]);
  }
});

const port = Number(process.env.PORT) || 8080;
console.log(`Video processor listening on port ${port}`);
serve({ fetch: app.fetch, port });
