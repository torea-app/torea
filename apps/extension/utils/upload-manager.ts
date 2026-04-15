import { recordingApi } from "../lib/api";
import { ERROR_MESSAGES, RECORDING } from "../lib/constants";
import type { UploadedPart, UploadProgress } from "../types/recording";
import { withRetry } from "./retry";

type UploadManagerOptions = {
  recordingId: string;
  onProgress?: (progress: UploadProgress) => void;
  /** バッファ溢れや致命的エラー発生時に呼ばれるコールバック */
  onError?: (message: string) => void;
};

/**
 * チャンク分割アップロードマネージャー
 *
 * MediaRecorder の ondataavailable で生成されるチャンク（8秒ごと）をバッファリングし、
 * 5MB 以上たまったら1つの「パート」としてサーバーに PUT アップロードする。
 * サーバーが R2 multipart upload のパートとして保存する。
 */
export class UploadManager {
  private buffer: Blob[] = [];
  private bufferSize = 0;
  private nextPartNumber = 1;
  private parts: UploadedPart[] = [];
  private totalUploadedBytes = 0;
  private uploadQueue: Promise<void> = Promise.resolve();
  private aborted = false;
  /** finalize() が正常完了したかどうか。abort() が complete 済みの録画を誤って中止しないために使用。 */
  private finalized = false;
  /** アップロードキューに積まれているがまだ送信完了していないバイト数。
   * bufferSize（メモリ上の未フラッシュデータ）と合わせて
   * ネットワーク遅延によるメモリ積算を監視する。 */
  private pendingUploadBytes = 0;
  private recordingId: string;
  private onProgress?: (progress: UploadProgress) => void;
  private onError?: (message: string) => void;

  constructor(options: UploadManagerOptions) {
    this.recordingId = options.recordingId;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /** アップロード済みバイト数 */
  get uploadedBytes(): number {
    return this.totalUploadedBytes;
  }

  /** チャンクをバッファに追加。固定サイズに達したらフラッシュ */
  addChunk(chunk: Blob): void {
    if (this.aborted) return;

    this.buffer.push(chunk);
    this.bufferSize += chunk.size;

    // R2 は全非最終パートが同一サイズであることを要求するため、
    // 固定サイズ単位でフラッシュする
    while (this.bufferSize >= RECORDING.MIN_PART_SIZE_BYTES) {
      this.flushExact();
    }

    // ネットワーク遅延でメモリが過大になった場合に録画を中止する。
    // bufferSize だけでなく pendingUploadBytes（キュー待ちの Blob）も含めて判定する。
    // ※ while ループ後の bufferSize は常に < MIN_PART_SIZE_BYTES のため、
    //    pendingUploadBytes を含めないと実質的にこの検査は到達不能になる。
    if (
      this.pendingUploadBytes + this.bufferSize >
      RECORDING.MAX_BUFFER_BYTES
    ) {
      this.aborted = true;
      this.abort().catch(() => {});
      this.onError?.(ERROR_MESSAGES.BUFFER_OVERFLOW);
    }
  }

  /**
   * バッファから正確に MIN_PART_SIZE_BYTES を切り出してアップロードキューに追加。
   *
   * 改善点: バッファ全体を1つの Blob に結合する代わりに、
   * バッファ先頭から必要なバイト数分だけを走査してスライスを作成する。
   * これにより while ループ内での大きな中間 Blob 生成を回避し、メモリ効率を向上させる。
   */
  private flushExact(): void {
    if (this.aborted) return;

    // MIN_PART_SIZE_BYTES に達するバッファ位置を特定する
    let accumulated = 0;
    let splitIndex = 0;
    let splitOffset = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      const next = accumulated + this.buffer[i].size;
      if (next >= RECORDING.MIN_PART_SIZE_BYTES) {
        splitIndex = i;
        splitOffset = RECORDING.MIN_PART_SIZE_BYTES - accumulated;
        break;
      }
      accumulated = next;
    }

    // splitIndex までのチャンク + splitIndex の先頭 splitOffset バイトをパートとする
    const partChunks: Blob[] = [
      ...this.buffer.slice(0, splitIndex),
      this.buffer[splitIndex].slice(0, splitOffset),
    ];
    const partBlob = new Blob(partChunks);

    // 残りをバッファに戻す（splitIndex の末尾 + それ以降のチャンク）
    const tail = this.buffer[splitIndex].slice(splitOffset);
    this.buffer = [
      ...(tail.size > 0 ? [tail] : []),
      ...this.buffer.slice(splitIndex + 1),
    ];
    this.bufferSize -= RECORDING.MIN_PART_SIZE_BYTES;

    this.enqueueUpload(partBlob);
  }

  /**
   * 残りバッファを最終パートとしてフラッシュする（サイズ制約なし）。
   */
  private flushRemaining(): void {
    if (this.aborted) return;
    if (this.bufferSize === 0) return;

    const blob = new Blob(this.buffer);
    this.buffer = [];
    this.bufferSize = 0;

    this.enqueueUpload(blob);
  }

  /** パートをアップロードキューに直列で追加 */
  private enqueueUpload(blob: Blob): void {
    const partNumber = this.nextPartNumber++;
    this.pendingUploadBytes += blob.size;

    this.uploadQueue = this.uploadQueue.then(async () => {
      if (this.aborted) return;

      try {
        const result = await withRetry(() =>
          recordingApi.uploadPart(this.recordingId, partNumber, blob),
        );

        this.pendingUploadBytes -= blob.size;
        this.parts.push(result);
        this.totalUploadedBytes += blob.size;

        this.onProgress?.({
          uploadedBytes: this.totalUploadedBytes,
          uploadedParts: this.parts.length,
        });
      } catch (error) {
        // 全リトライ失敗 → 以降の addChunk を無視し、unhandled rejection の連鎖を防ぐ
        this.aborted = true;
        throw error;
      }
    });
  }

  /**
   * 残りバッファをフラッシュし、全アップロード完了を待ってから
   * サーバーに complete リクエストを送信する。
   */
  async finalize(durationMs: number): Promise<void> {
    // 残りバッファを最終パートとしてフラッシュ（サイズ制約なし）
    this.flushRemaining();

    // 全アップロード完了待ち
    await this.uploadQueue;

    if (this.aborted) return;

    // パート番号順にソート
    const sortedParts = [...this.parts].sort(
      (a, b) => a.partNumber - b.partNumber,
    );

    // サーバーに complete リクエスト
    await recordingApi.complete(this.recordingId, {
      parts: sortedParts,
      durationMs,
      fileSize: this.totalUploadedBytes,
    });

    // complete 完了後にフラグをセット。
    // cleanupResources() が abort() を呼んでも complete 済みの録画を中止しないようにする。
    this.finalized = true;
  }

  /** アップロードを中止 */
  async abort(): Promise<void> {
    // finalize() が正常完了した後は abort しない（complete 済みの録画を誤って中止しない）
    if (this.finalized) return;
    this.aborted = true;
    try {
      await recordingApi.abort(this.recordingId);
    } catch {
      // abort の失敗は無視（R2 が 7 日後に自動削除）
    }
  }
}
