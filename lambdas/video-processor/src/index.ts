import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { rm, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { extractAudio, splitIntoChunks } from "./ffmpeg.js";
import { transcribeChunksParallel } from "./groq-client.js";
import { mergeChunkResults } from "./merge.js";
import type {
  TranscribeErrorResponse,
  TranscribeRequest,
  TranscribeResponse,
} from "./types.js";

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

app.post("/transcribe", async (c) => {
  const startTime = Date.now();
  const body = await c.req.json<TranscribeRequest>();
  const { r2Key, recordingId, language, model } = body;

  if (!r2Key || !recordingId) {
    return c.json(
      {
        success: false,
        error: "r2Key and recordingId are required",
      } satisfies TranscribeErrorResponse,
      400,
    );
  }

  const inputPath = "/tmp/input_transcribe.mp4";
  const audioPath = "/tmp/audio.flac";
  const chunkDir = "/tmp/chunks";

  try {
    // 1. R2 から動画ダウンロード
    const getRes = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }),
    );
    if (!getRes.Body) {
      return c.json(
        {
          success: false,
          error: "Failed to download from R2",
        } satisfies TranscribeErrorResponse,
        500,
      );
    }

    const writeStream = createWriteStream(inputPath);
    // @ts-expect-error -- S3 Body is a Readable stream in Node.js
    await pipeline(getRes.Body, writeStream);

    // 2. ffmpeg で音声抽出（16kHz mono FLAC）
    await extractAudio(inputPath, audioPath);

    // 入力動画は不要になったので即削除（/tmp 容量節約）
    await unlink(inputPath).catch(() => {});

    // 3. チャンク分割（10 分 + 10 秒オーバーラップ）
    const {
      chunkPaths,
      chunkStartsSec,
      totalDuration: duration,
    } = await splitIntoChunks(audioPath, chunkDir, 600, 10);

    // 音声ファイルは不要になったので即削除
    await unlink(audioPath).catch(() => {});

    // 4. Groq API に並列送信
    const chunkResults = await transcribeChunksParallel(
      chunkPaths,
      chunkStartsSec,
      language,
      model,
    );

    // 送信完了したチャンクファイルを即削除
    await Promise.allSettled(chunkPaths.map((p) => unlink(p)));

    // 5. マージ
    const merged = mergeChunkResults(chunkResults, 10);

    const processingTime = (Date.now() - startTime) / 1000;

    const response: TranscribeResponse = {
      success: true,
      recordingId,
      language: language ?? "auto",
      duration,
      fullText: merged.fullText,
      segments: merged.segments,
      model: model ?? "whisper-large-v3-turbo",
      chunkCount: chunkPaths.length,
      processingTime,
    };

    return c.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Transcription failed:", message);
    return c.json(
      { success: false, error: message } satisfies TranscribeErrorResponse,
      500,
    );
  } finally {
    // /tmp のファイルを全削除
    await Promise.allSettled([
      unlink(inputPath),
      unlink(audioPath),
      rm(chunkDir, { recursive: true, force: true }),
    ]);
  }
});

const port = Number(process.env.PORT) || 8080;
console.log(`Video processor listening on port ${port}`);
serve({ fetch: app.fetch, port });
