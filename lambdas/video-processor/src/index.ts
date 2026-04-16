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
import {
  extractAudio,
  GROQ_FILE_SIZE_LIMIT,
  getFileSize,
  splitIntoChunks,
} from "./ffmpeg.js";
import { transcribeChunk, transcribeChunksParallel } from "./groq-client.js";
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

/** チャンク分割時の 1 チャンクの長さ（60 分） */
const CHUNK_DURATION_SEC = 3600;
/** チャンク間のオーバーラップ（10 秒） */
const OVERLAP_SEC = 10;

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
  const audioPath = "/tmp/audio.mp3";
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

    // 2. ffmpeg で音声抽出（16kHz mono MP3 32kbps）
    await extractAudio(inputPath, audioPath);

    // 入力動画は不要になったので即削除（/tmp 容量節約）
    await unlink(inputPath).catch(() => {});

    // 3. ファイルサイズに応じて単一リクエスト or チャンク分割
    const audioSize = await getFileSize(audioPath);

    let duration: number;
    let chunkCount: number;
    let merged: {
      segments: { start: number; end: number; text: string }[];
      fullText: string;
    };

    if (audioSize < GROQ_FILE_SIZE_LIMIT) {
      // 25 MB 未満: 単一リクエスト（Groq のセグメントをそのまま使用）
      const result = await transcribeChunk(audioPath, language, model);
      const segments = result.segments
        .filter((seg) => {
          if (seg.no_speech_prob > 0.6) return false;
          if (seg.avg_logprob < -1.0) return false;
          if (seg.compression_ratio > 2.4) return false;
          return true;
        })
        .map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        }));

      // ffprobe で再生時間取得（音声ファイル削除前に）
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        audioPath,
      ]);
      duration = Number.parseFloat(stdout.trim()) || 0;
      chunkCount = 1;
      merged = {
        segments,
        fullText: segments.map((s) => s.text).join(""),
      };
    } else {
      // 25 MB 以上: チャンク分割（60 分 + 10 秒オーバーラップ）
      const splitResult = await splitIntoChunks(
        audioPath,
        chunkDir,
        CHUNK_DURATION_SEC,
        OVERLAP_SEC,
      );
      duration = splitResult.totalDuration;
      chunkCount = splitResult.chunkPaths.length;

      // 音声ファイルは不要になったので即削除
      await unlink(audioPath).catch(() => {});

      // Groq API に並列送信
      const chunkResults = await transcribeChunksParallel(
        splitResult.chunkPaths,
        splitResult.chunkStartsSec,
        language,
        model,
      );

      // チャンクファイルを即削除
      await Promise.allSettled(splitResult.chunkPaths.map((p) => unlink(p)));

      // セグメント単位でマージ
      merged = mergeChunkResults(chunkResults, OVERLAP_SEC);
    }

    const processingTime = (Date.now() - startTime) / 1000;

    const response: TranscribeResponse = {
      success: true,
      recordingId,
      language: language ?? "auto",
      duration,
      fullText: merged.fullText,
      segments: merged.segments,
      model: model ?? "whisper-large-v3-turbo",
      chunkCount,
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
