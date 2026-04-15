import { QUALITY_PRESETS, RECORDING } from "../../lib/constants";
import type { ExtensionMessage } from "../../types/message";
import type { VideoQuality } from "../../types/recording";
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
let tabStream: MediaStream | null = null;
let recordingStartTime: number | null = null;

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
// 録画開始
// =============================================

async function startRecording(
  streamId: string,
  recordingId: string,
  micEnabled: boolean,
  quality: VideoQuality,
): Promise<void> {
  // 1. MIME タイプ検出
  const { mimeType } = detectMimeType();

  // 2. 品質プリセットを取得
  const preset = QUALITY_PRESETS[quality];

  // 3. タブストリーム取得
  tabStream = await navigator.mediaDevices.getUserMedia({
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

  // 4. オーディオミキシング（タブ音声 + マイク）
  audioMixer = await createAudioMixer(tabStream, micEnabled);

  // 5. ミキシングされた音声 + タブ映像で新しい MediaStream を作成
  const videoTracks = tabStream.getVideoTracks();
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

  // 10. Background に録画開始を通知
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

  for (const track of tabStream?.getTracks() ?? []) {
    track.stop();
  }
  tabStream = null;

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

      case "OFFSCREEN_START_RECORDING":
        startRecording(
          message.streamId,
          message.recordingId,
          message.micEnabled,
          message.quality,
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
