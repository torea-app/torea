import type { ChunkResult, GroqSegment, Segment } from "./types.js";

/**
 * ハルシネーション検出。
 * 無音区間の誤認識、低信頼度セグメント、テキストの繰り返しを検出する。
 */
function isHallucination(seg: GroqSegment): boolean {
  if (seg.no_speech_prob > 0.6) return true;
  if (seg.avg_logprob < -1.0) return true;
  if (seg.compression_ratio > 2.4) return true;
  return false;
}

/**
 * 全チャンクの結果をマージする。
 *
 * Groq のネイティブセグメント（句読点・自然な区切り付き）をそのまま使用し、
 * チャンク間のオーバーラップ領域はセグメント単位の中間点戦略で解決する。
 *
 * 中間点戦略: 隣接チャンクのオーバーラップ領域の中間時刻を境界とし、
 * 各セグメントの開始時刻がどちらの領域に属するかで所属チャンクを決定する。
 */
export function mergeChunkResults(
  chunkResults: ChunkResult[],
  overlapSec: number,
): { segments: Segment[]; fullText: string } {
  if (chunkResults.length === 0) {
    return { segments: [], fullText: "" };
  }

  // 各チャンク: ハルシネーション除去 + グローバルタイムスタンプ変換
  const adjustedChunks = chunkResults.map((chunk) => ({
    chunkStartSec: chunk.chunkStartSec,
    segments: chunk.segments
      .filter((seg) => !isHallucination(seg))
      .map((seg) => ({
        start: seg.start + chunk.chunkStartSec,
        end: seg.end + chunk.chunkStartSec,
        text: seg.text,
      })),
  }));

  // 単一チャンク: セグメントをそのまま返す
  if (adjustedChunks.length === 1) {
    const segments = adjustedChunks[0]?.segments ?? [];
    return {
      segments,
      fullText: segments.map((s) => s.text).join(""),
    };
  }

  // 複数チャンク: オーバーラップ中間点でセグメントを振り分け
  const merged: Segment[] = [];

  for (let i = 0; i < adjustedChunks.length; i++) {
    const chunk = adjustedChunks[i];
    if (!chunk) continue;

    // このチャンクが「所有する」時間範囲を決定
    const lowerBound = i === 0 ? 0 : chunk.chunkStartSec + overlapSec / 2;

    const nextChunkStart = adjustedChunks[i + 1]?.chunkStartSec;
    const upperBound =
      nextChunkStart !== undefined
        ? nextChunkStart + overlapSec / 2
        : Number.POSITIVE_INFINITY;

    for (const seg of chunk.segments) {
      if (seg.start >= lowerBound && seg.start < upperBound) {
        merged.push(seg);
      }
    }
  }

  return {
    segments: merged,
    fullText: merged.map((s) => s.text).join(""),
  };
}
