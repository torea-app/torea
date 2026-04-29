import {
  ERROR_MESSAGES,
  QUALITY_PRESETS,
  RECORDING,
} from "../../lib/constants";
import type { ExtensionMessage } from "../../types/message";
import type { RecordingMode, VideoQuality } from "../../types/recording";
import {
  type AudioMixerResult,
  createAudioMixer,
} from "../../utils/audio-mixer";
import { UploadManager } from "../../utils/upload-manager";

// =============================================
// 状態
// =============================================

let mediaRecorder: MediaRecorder | null = null;
let uploadManager: UploadManager | null = null;
let audioMixer: AudioMixerResult | null = null;
/** 録画用の生映像／音声ストリーム（tab capture または getDisplayMedia） */
let captureStream: MediaStream | null = null;
/** display モードで OFFSCREEN_PREPARE_DISPLAY_CAPTURE 後に保持しておく事前ストリーム */
let preparedDisplayStream: MediaStream | null = null;
let recordingStartTime: number | null = null;

/**
 * 録画上限到達（プラン上限 or 月の残量の小さい方）で自動停止するためのタイマ。
 * 警告 2 件（残り 2 分 / 30 秒）と上限到達の 3 つを保持する。
 */
const autoStopTimers: Array<ReturnType<typeof setTimeout>> = [];

function clearAutoStopTimers(): void {
  for (const id of autoStopTimers) clearTimeout(id);
  autoStopTimers.length = 0;
}

/**
 * `effectiveLimitMs` 後に MediaRecorder を自動停止し、その前に 2 分前 / 30 秒前を
 * Background へ通知する。`effectiveLimitMs` が極端に短い場合は、対応する警告は
 * 発火させない（負の遅延でタイマを張らない）。
 */
function scheduleAutoStop(effectiveLimitMs: number): void {
  clearAutoStopTimers();
  const warnings: ReadonlyArray<number> = [2 * 60_000, 30_000];
  for (const remainingMs of warnings) {
    const fireAt = effectiveLimitMs - remainingMs;
    if (fireAt > 0) {
      autoStopTimers.push(
        setTimeout(() => {
          browser.runtime
            .sendMessage({
              type: "RECORDING_LIMIT_WARNING",
              remainingMs,
            } satisfies ExtensionMessage)
            .catch(() => {});
        }, fireAt),
      );
    }
  }
  autoStopTimers.push(
    setTimeout(() => {
      // 通知 → 停止の順。Background が通知を出す前に停止フローが走ると
      // ユーザーに「自動停止された」という UX が伝わりにくいため。
      browser.runtime
        .sendMessage({
          type: "RECORDING_LIMIT_REACHED",
        } satisfies ExtensionMessage)
        .catch(() => {});
      stopRecording();
    }, effectiveLimitMs),
  );
}

// =============================================
// MV3 Service Worker キープアライブ
// =============================================

/**
 * MV3 の Service Worker は非アクティブ時に強制終了される。
 * Offscreen Document から定期的に KEEPALIVE メッセージを送ることで
 * Service Worker を維持し、長時間録画中のクラッシュリカバリーを防ぐ。
 * 間隔は SW の典型的なアイドルタイムアウト（30 秒）より短い 20 秒に設定する。
 */
let keepaliveInterval: ReturnType<typeof setInterval> | null = null;

function startKeepalive(): void {
  if (keepaliveInterval !== null) return;
  keepaliveInterval = setInterval(() => {
    browser.runtime
      .sendMessage({ type: "KEEPALIVE" } satisfies ExtensionMessage)
      .catch(() => {
        // SW が応答しない場合は無視（次の KEEPALIVE で再試行される）
      });
  }, 20_000);
}

function stopKeepalive(): void {
  if (keepaliveInterval !== null) {
    clearInterval(keepaliveInterval);
    keepaliveInterval = null;
  }
}

// =============================================
// MIME タイプ検出
// =============================================

/**
 * ブラウザがサポートする MIME タイプを検出する。
 * MP4 を優先（Safari での再生互換性のため）、フォールバックとして WebM。
 */
function detectMimeType(): { mimeType: string; baseMimeType: string } {
  const candidates = [
    {
      mimeType: "video/mp4;codecs=avc1.424028,mp4a.40.2",
      baseMimeType: "video/mp4",
    },
    {
      mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      baseMimeType: "video/mp4",
    },
    { mimeType: "video/mp4", baseMimeType: "video/mp4" },
    {
      mimeType: "video/webm;codecs=vp9,opus",
      baseMimeType: "video/webm",
    },
    {
      mimeType: "video/webm;codecs=vp8,opus",
      baseMimeType: "video/webm",
    },
    { mimeType: "video/webm", baseMimeType: "video/webm" },
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  // 最終フォールバック（通常到達しない）
  return { mimeType: "video/webm", baseMimeType: "video/webm" };
}

// =============================================
// getDisplayMedia エラーマッピング
// =============================================

function getDisplayMediaErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    // ユーザーが Chrome のピッカーで「キャンセル」した
    if (error.name === "NotAllowedError") {
      // メッセージ内容で OS 権限拒否とユーザーキャンセルを区別する
      // （NotAllowedError は両ケースで投げられる）
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("permission") || msg.includes("denied")) {
        return ERROR_MESSAGES.DISPLAY_CAPTURE_DENIED;
      }
      return ERROR_MESSAGES.DISPLAY_CAPTURE_CANCELLED;
    }
    if (error.name === "NotFoundError") {
      return ERROR_MESSAGES.DISPLAY_CAPTURE_FAILED;
    }
  }
  return ERROR_MESSAGES.DISPLAY_CAPTURE_FAILED;
}

// =============================================
// display モード: ピッカー事前取得
// =============================================

/**
 * Chrome のピッカーを開いて画面/ウィンドウ/タブを選ばせる。
 * 取得した MediaStream は preparedDisplayStream に保持し、
 * その後 OFFSCREEN_START_RECORDING で MediaRecorder に渡す。
 *
 * 呼び出し元（Background → Popup の click から伝播した user gesture）の
 * トランジェントアクティベーションが必要。Background から
 * 速やかに本メッセージを送ることで失効を避ける。
 */
async function prepareDisplayCapture(): Promise<{
  ok: boolean;
  displaySurface?: string;
  label?: string;
  error?: string;
}> {
  // 二重取得を避ける
  if (preparedDisplayStream) {
    discardPreparedStream();
  }

  try {
    // 制約解説:
    // - audio:true ... ピッカーに「音声を共有」系チェックを表示
    // - systemAudio:"include" ... 画面ソース選択時に「システム音声を共有」を提示（明示）
    // - windowAudio:"window" ... Chrome 141+ で「ウィンドウの音声を共有」を提示
    //   （macOS 14.2+ / Windows / ChromeOS で機能。古い Chrome は単に無視されるヒント）
    // - selfBrowserSurface:"exclude" ... ユーザーが Torea の UI を録画ソースに選ぶのを防止
    //
    // windowAudio / systemAudio / selfBrowserSurface は TS lib に未収録の場合があるため
    // ローカルに型を補強する。
    type ExtendedDisplayMediaStreamOptions = DisplayMediaStreamOptions & {
      systemAudio?: "include" | "exclude";
      windowAudio?: "include" | "exclude" | "system" | "window";
      selfBrowserSurface?: "include" | "exclude";
    };
    const constraints: ExtendedDisplayMediaStreamOptions = {
      video: true,
      audio: true,
      systemAudio: "include",
      windowAudio: "window",
      selfBrowserSurface: "exclude",
    };
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

    preparedDisplayStream = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack?.getSettings() as
      | (MediaTrackSettings & { displaySurface?: string })
      | undefined;

    return {
      ok: true,
      displaySurface: settings?.displaySurface,
      label: videoTrack?.label,
    };
  } catch (error) {
    return { ok: false, error: getDisplayMediaErrorMessage(error) };
  }
}

function discardPreparedStream(): void {
  for (const track of preparedDisplayStream?.getTracks() ?? []) {
    track.stop();
  }
  preparedDisplayStream = null;
}

// =============================================
// 録画開始
// =============================================

async function startRecording(
  mode: RecordingMode,
  streamId: string | undefined,
  recordingId: string,
  micEnabled: boolean,
  quality: VideoQuality,
  effectiveLimitMs: number | undefined,
): Promise<void> {
  // 1. MIME タイプ検出
  const { mimeType } = detectMimeType();

  // 2. 品質プリセットを取得
  const preset = QUALITY_PRESETS[quality];

  // 3. キャプチャストリーム取得（モード別）
  if (mode === "tab") {
    if (!streamId) {
      throw new Error("streamId is required for tab mode");
    }
    captureStream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
          maxWidth: preset.videoWidth,
          maxHeight: preset.videoHeight,
          maxFrameRate: preset.frameRate,
        },
      } as MediaTrackConstraints,
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      } as MediaTrackConstraints,
    });
  } else {
    // display モード: 事前に prepareDisplayCapture で取得済みのストリームを使う
    if (!preparedDisplayStream) {
      throw new Error(
        "display モードでは OFFSCREEN_PREPARE_DISPLAY_CAPTURE が先に必要です",
      );
    }
    captureStream = preparedDisplayStream;
    preparedDisplayStream = null;

    // フレームレート上限を後段で適用（mandatory が使えないため applyConstraints）
    const videoTrack = captureStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack
        .applyConstraints({ frameRate: { max: preset.frameRate } })
        .catch(() => {
          // 制約が適用できない環境では無視（フレームレートはソース依存）
        });

      // ユーザーが Chrome の「共有を停止」ボタン or
      // 共有元ウィンドウのクローズで track が ended になったら通知
      videoTrack.addEventListener("ended", () => {
        browser.runtime
          .sendMessage({
            type: "DISPLAY_CAPTURE_ENDED",
          } satisfies ExtensionMessage)
          .catch(() => {});
      });
    }
  }

  // 4. オーディオミキシング（タブ／システム音声 + マイク）
  audioMixer = await createAudioMixer(captureStream, micEnabled, mode);

  // 5. ミキシングされた音声 + 映像で新しい MediaStream を作成
  const videoTracks = captureStream.getVideoTracks();
  const mixedAudioTracks = audioMixer.mixedStream.getAudioTracks();
  const combinedStream = new MediaStream([...videoTracks, ...mixedAudioTracks]);

  // 6. UploadManager 初期化
  uploadManager = new UploadManager({
    recordingId,
    onProgress(progress) {
      browser.runtime.sendMessage({
        type: "UPLOAD_PROGRESS",
        progress,
      } satisfies ExtensionMessage);
    },
    onError(message) {
      // バッファ溢れ等の致命的エラー → Background に通知してリソース解放
      browser.runtime.sendMessage({
        type: "RECORDING_ERROR",
        error: message,
      } satisfies ExtensionMessage);
      cleanupResources();
    },
  });

  // 7. MediaRecorder 作成
  mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: preset.videoBitrate,
    audioBitsPerSecond: preset.audioBitrate,
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      uploadManager?.addChunk(event.data);
    }
  };

  mediaRecorder.onstop = () => {
    finalizeRecording();
  };

  mediaRecorder.onerror = () => {
    browser.runtime.sendMessage({
      type: "RECORDING_ERROR",
      error: "MediaRecorder でエラーが発生しました",
    } satisfies ExtensionMessage);
    cleanupResources();
  };

  // 8. 録画開始
  recordingStartTime = Date.now();
  mediaRecorder.start(RECORDING.CHUNK_INTERVAL_MS);

  // 9. Service Worker キープアライブ開始
  startKeepalive();

  // 10. 自動停止タイマ（プラン上限 or 月の残量の小さい方）。
  //    Background が effectiveLimitMs を計算し、未指定の場合は自動停止しない。
  if (effectiveLimitMs !== undefined && effectiveLimitMs > 0) {
    scheduleAutoStop(effectiveLimitMs);
  }

  // 11. Background に録画開始を通知
  browser.runtime.sendMessage({
    type: "RECORDING_STARTED",
  } satisfies ExtensionMessage);
}

// =============================================
// 録画停止
// =============================================

function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

// =============================================
// 録画完了処理
// =============================================

async function finalizeRecording(): Promise<void> {
  const durationMs = recordingStartTime ? Date.now() - recordingStartTime : 0;

  try {
    await uploadManager?.finalize(durationMs);

    browser.runtime.sendMessage({
      type: "VIDEO_READY",
      durationMs,
      fileSize: uploadManager?.uploadedBytes ?? 0,
    } satisfies ExtensionMessage);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "アップロードの完了に失敗しました";
    browser.runtime.sendMessage({
      type: "RECORDING_ERROR",
      error: message,
    } satisfies ExtensionMessage);
  } finally {
    cleanupResources();
  }
}

// =============================================
// リソース解放
// =============================================

function cleanupResources(): void {
  // キープアライブを停止（録画が終わったら SW を維持する必要はない）
  stopKeepalive();

  // 自動停止タイマも解除（手動停止時の二重発火を避ける）
  clearAutoStopTimers();

  for (const track of captureStream?.getTracks() ?? []) {
    track.stop();
  }
  captureStream = null;

  // 念のため事前ストリームも破棄
  discardPreparedStream();

  audioMixer?.cleanup();
  audioMixer = null;

  mediaRecorder = null;

  // abort() を先に呼び、キュー内の残アップロードを停止してから参照を破棄する
  uploadManager?.abort().catch(() => {});
  uploadManager = null;

  recordingStartTime = null;
}

// =============================================
// メッセージハンドラー
// =============================================

browser.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case "QUERY_MIME_TYPE":
        // 同期的に MIME タイプを返す（detectMimeType は同期関数）
        sendResponse({ mimeType: detectMimeType().baseMimeType });
        return false;

      case "OFFSCREEN_PREPARE_DISPLAY_CAPTURE":
        prepareDisplayCapture()
          .then((result) => sendResponse(result))
          .catch((error: unknown) => {
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : ERROR_MESSAGES.DISPLAY_CAPTURE_FAILED,
            });
          });
        return true;

      case "OFFSCREEN_DISCARD_PREPARED_STREAM":
        discardPreparedStream();
        sendResponse({ success: true });
        return false;

      case "OFFSCREEN_START_RECORDING":
        startRecording(
          message.mode,
          message.streamId,
          message.recordingId,
          message.micEnabled,
          message.quality,
          message.effectiveLimitMs,
        )
          .then(() => sendResponse({ success: true }))
          .catch((error: unknown) => {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "録画の開始に失敗しました";
            cleanupResources();
            sendResponse({ success: false, error: errorMessage });
          });
        return true; // 非同期レスポンスを示す

      case "OFFSCREEN_STOP_RECORDING":
        stopRecording();
        sendResponse({ success: true });
        return false;
    }
  },
);
