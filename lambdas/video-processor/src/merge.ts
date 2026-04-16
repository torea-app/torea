import type { ChunkResult, GroqSegment, Segment, Word } from "./types.js";

const DEFAULT_MAX_GAP_SEC = 1.0;

/**
 * ハルシネーション検出。
 * 無音区間の誤認識、低信頼度セグメント、テキストの繰り返しを検出する。
 */
export function isHallucination(seg: GroqSegment): boolean {
  if (seg.no_speech_prob > 0.6) return true;
  if (seg.avg_logprob < -1.0) return true;
  if (seg.compression_ratio > 2.4) return true;
  return false;
}

/**
 * ハルシネーションと判定されたセグメントを除外する。
 * 除外されたセグメントの時間範囲に含まれるワードも除外する。
 */
function filterHallucinations(
  segments: GroqSegment[],
  words: Word[],
): { segments: GroqSegment[]; words: Word[] } {
  const validSegments = segments.filter((seg) => !isHallucination(seg));

  // 有効なセグメントの時間範囲を収集
  const validRanges = validSegments.map((seg) => ({
    start: seg.start,
    end: seg.end,
  }));

  // ワードが有効な時間範囲内に含まれるかチェック
  const validWords = words.filter((w) =>
    validRanges.some((r) => w.start >= r.start && w.end <= r.end + 0.01),
  );

  return { segments: validSegments, words: validWords };
}

/**
 * ワードの正規化。小文字化 + 句読点除去。
 * オーバーラップ領域のワード比較に使用する。
 */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[.,!?、。！？「」『』（）\s]/g, "");
}

/**
 * オーバーラップ領域のワード列をスライディングウィンドウで比較し、
 * 最長一致部分列の位置を返す。
 *
 * Groq 公式 Cookbook と同一のアルゴリズム。
 */
export function findLongestCommonSequence(
  wordsA: string[],
  wordsB: string[],
  minMatches = 2,
): { splitA: number; splitB: number } | null {
  let bestScore = 0;
  let bestSplitA = -1;
  let bestSplitB = -1;

  for (let offset = 0; offset < wordsA.length + wordsB.length; offset++) {
    const startA = Math.max(0, wordsA.length - offset);
    const startB = Math.max(0, offset - wordsA.length);
    const len = Math.min(wordsA.length - startA, wordsB.length - startB);

    let matches = 0;
    for (let i = 0; i < len; i++) {
      const a = wordsA[startA + i];
      const b = wordsB[startB + i];
      if (a !== undefined && b !== undefined && normalize(a) === normalize(b)) {
        matches++;
      }
    }

    const score = matches + matches / (len + 1e-6);
    if (matches >= minMatches && score > bestScore) {
      bestScore = score;
      const mid = Math.floor(matches / 2);
      bestSplitA = startA + mid;
      bestSplitB = startB + mid;
    }
  }

  return bestSplitA >= 0 ? { splitA: bestSplitA, splitB: bestSplitB } : null;
}

/**
 * 全チャンクの結果をマージする。
 *
 * 1. 各チャンクのハルシネーション除去
 * 2. グローバルタイムスタンプへの変換
 * 3. オーバーラップ領域の LCS マージ
 * 4. セグメント再構築
 */
export function mergeChunkResults(
  chunkResults: ChunkResult[],
  overlapSec: number,
): { segments: Segment[]; fullText: string } {
  if (chunkResults.length === 0) {
    return { segments: [], fullText: "" };
  }

  // 各チャンクのハルシネーション除去 + グローバルタイムスタンプ変換
  const adjustedChunks = chunkResults.map((chunk) => {
    const filtered = filterHallucinations(chunk.segments, chunk.words);
    return {
      chunkStartSec: chunk.chunkStartSec,
      words: filtered.words.map((w) => ({
        ...w,
        start: w.start + chunk.chunkStartSec,
        end: w.end + chunk.chunkStartSec,
      })),
    };
  });

  const firstChunk = adjustedChunks[0];
  if (!firstChunk) {
    return { segments: [], fullText: "" };
  }
  let mergedWords: Word[] = firstChunk.words;

  for (let i = 1; i < adjustedChunks.length; i++) {
    const prevWords = mergedWords;
    const nextChunk = adjustedChunks[i];
    if (!nextChunk) continue;
    const nextWords = nextChunk.words;
    const overlapStart = nextChunk.chunkStartSec;

    // オーバーラップ領域のワードを抽出
    const prevOverlap = prevWords.filter((w) => w.start >= overlapStart);
    const nextOverlap = nextWords.filter(
      (w) => w.end <= overlapStart + overlapSec,
    );

    const match = findLongestCommonSequence(
      prevOverlap.map((w) => w.word),
      nextOverlap.map((w) => w.word),
    );

    if (match) {
      // 一致ポイントで分割: prev の前半 + next の後半
      const prevSplitWord = prevOverlap[match.splitA];
      const nextSplitWord = nextOverlap[match.splitB];
      if (prevSplitWord && nextSplitWord) {
        const prevKeepIdx = prevWords.indexOf(prevSplitWord);
        const nextStartIdx = nextWords.indexOf(nextSplitWord);
        mergedWords = [
          ...prevWords.slice(0, prevKeepIdx),
          ...nextWords.slice(nextStartIdx),
        ];
      } else {
        const lastPrevEnd = prevWords[prevWords.length - 1]?.end ?? 0;
        const nonOverlapping = nextWords.filter((w) => w.start >= lastPrevEnd);
        mergedWords = [...prevWords, ...nonOverlapping];
      }
    } else {
      // 一致なし: タイムスタンプベースのフォールバック
      const lastPrevEnd = prevWords[prevWords.length - 1]?.end ?? 0;
      const nonOverlapping = nextWords.filter((w) => w.start >= lastPrevEnd);
      mergedWords = [...prevWords, ...nonOverlapping];
    }
  }

  const segments = rebuildSegments(mergedWords);
  const fullText = segments.map((s) => s.text).join("");

  return { segments, fullText };
}

/**
 * マージ済みワード列からセグメントを再構築する。
 * 1 秒以上の無音ギャップでセグメントを区切る。
 */
export function rebuildSegments(
  words: Word[],
  maxGapSec = DEFAULT_MAX_GAP_SEC,
): Segment[] {
  const firstWord = words[0];
  if (!firstWord) return [];

  const segments: Segment[] = [];
  let currentWords: Word[] = [firstWord];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const prevWord = words[i - 1];
    if (!word || !prevWord) continue;
    const gap = word.start - prevWord.end;
    if (gap > maxGapSec) {
      segments.push(wordsToSegment(currentWords));
      currentWords = [word];
    } else {
      currentWords.push(word);
    }
  }

  if (currentWords.length > 0) {
    segments.push(wordsToSegment(currentWords));
  }

  return segments;
}

function wordsToSegment(words: Word[]): Segment {
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) {
    throw new Error("wordsToSegment requires a non-empty array");
  }
  return {
    start: first.start,
    end: last.end,
    text: words.map((w) => w.word).join(""),
  };
}
