import fs from "node:fs";
import Groq from "groq-sdk";
import type { ChunkResult, GroqSegment } from "./types.js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = "whisper-large-v3-turbo";
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * 単一の音声ファイルを Groq Whisper API に送信し、セグメント単位の文字起こし結果を返す。
 */
export async function transcribeChunk(
  chunkPath: string,
  language?: string,
  model?: string,
): Promise<{ segments: GroqSegment[]; text: string }> {
  const response = await groq.audio.transcriptions.create({
    file: fs.createReadStream(chunkPath),
    model: model ?? DEFAULT_MODEL,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
    ...(language ? { language } : {}),
    temperature: 0,
  });

  const result = response as unknown as {
    text: string;
    segments: GroqSegment[];
  };

  return {
    text: result.text ?? "",
    segments: result.segments ?? [],
  };
}

/**
 * 複数チャンクを並列度 CONCURRENCY で Groq API に送信する。
 */
export async function transcribeChunksParallel(
  chunkPaths: string[],
  chunkStartsSec: number[],
  language?: string,
  model?: string,
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = [];

  for (let i = 0; i < chunkPaths.length; i += CONCURRENCY) {
    const batch = chunkPaths.slice(i, i + CONCURRENCY);
    const batchStarts = chunkStartsSec.slice(i, i + CONCURRENCY);

    const batchEntries = batch.map((chunkPath, j) => ({
      chunkPath,
      chunkIndex: i + j,
      chunkStartSec: batchStarts[j] ?? 0,
    }));

    const batchResults = await Promise.all(
      batchEntries.map(async (entry) => {
        const result = await transcribeWithRetry(
          entry.chunkPath,
          language,
          model,
        );
        return {
          chunkIndex: entry.chunkIndex,
          chunkStartSec: entry.chunkStartSec,
          segments: result.segments,
        } satisfies ChunkResult;
      }),
    );

    results.push(...batchResults);
  }

  return results;
}

/**
 * Groq API の 429/5xx エラーに対して指数バックオフでリトライする。
 */
async function transcribeWithRetry(
  chunkPath: string,
  language?: string,
  model?: string,
): Promise<{ segments: GroqSegment[]; text: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await transcribeChunk(chunkPath, language, model);
    } catch (err) {
      const isRetryable =
        err instanceof Groq.APIError &&
        (err.status === 429 || (err.status !== undefined && err.status >= 500));

      if (!isRetryable || attempt === MAX_RETRIES - 1) {
        throw err;
      }

      const delay = RETRY_DELAY_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}
