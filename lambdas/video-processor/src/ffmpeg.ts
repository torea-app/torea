import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { SplitResult } from "./types.js";

const execFileAsync = promisify(execFile);

/** Groq API のファイルサイズ上限（25 MB） */
export const GROQ_FILE_SIZE_LIMIT = 25 * 1024 * 1024;

/**
 * 動画ファイルから音声を抽出する（16kHz モノラル MP3 32kbps）。
 * MP3 32kbps: ~4 KB/s → 25 MB で約 104 分収容可能。
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-b:a",
    "32k",
    outputPath,
  ]);
}

/**
 * ファイルサイズ（バイト）を取得する。
 */
export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

/**
 * ffprobe で音声ファイルの総再生時間（秒）を取得する。
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    audioPath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (Number.isNaN(duration)) {
    throw new Error(`Failed to parse audio duration from: ${stdout.trim()}`);
  }
  return duration;
}

/**
 * 音声ファイルを固定長チャンクに分割する。
 * 各チャンク間にオーバーラップを設け、境界での単語切断を防止する。
 *
 * @returns チャンクファイルパス・開始秒・総再生時間
 */
export async function splitIntoChunks(
  audioPath: string,
  outputDir: string,
  chunkDurationSec: number,
  overlapSec: number,
): Promise<SplitResult> {
  await mkdir(outputDir, { recursive: true });

  const totalDuration = await getAudioDuration(audioPath);
  const chunkPaths: string[] = [];
  const chunkStartsSec: number[] = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < totalDuration) {
    const chunkFileName = `chunk_${String(chunkIndex).padStart(3, "0")}.mp3`;
    const chunkPath = path.join(outputDir, chunkFileName);

    // 最終チャンク: 残り全体を含める
    const isLastChunk = start + chunkDurationSec + overlapSec >= totalDuration;
    const duration = isLastChunk
      ? totalDuration - start
      : chunkDurationSec + overlapSec;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      audioPath,
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-b:a",
      "32k",
      chunkPath,
    ]);

    chunkPaths.push(chunkPath);
    chunkStartsSec.push(start);
    chunkIndex++;

    if (isLastChunk) break;

    // 次チャンクの開始位置: オーバーラップ分だけ手前から
    start += chunkDurationSec;
  }

  return { chunkPaths, chunkStartsSec, totalDuration };
}
