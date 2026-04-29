import type { RecordingMode, UploadProgress, VideoQuality } from "./recording";

// =============================================
// Popup → Background
// =============================================

type StartRecordingMessage = {
  type: "START_RECORDING";
  mode: RecordingMode;
  micEnabled: boolean;
  quality: VideoQuality;
};

type StopRecordingMessage = {
  type: "STOP_RECORDING";
};

// =============================================
// Background → Offscreen
// =============================================

/**
 * "display" モード時に getDisplayMedia の Chrome ピッカーを開く要求。
 * ユーザーが画面 / ウィンドウ / タブを選ぶと、Offscreen が MediaStream を保持し、
 * { ok: true, displaySurface, label } を返す。
 * キャンセル時は { ok: false, error } を返す。
 */
type OffscreenPrepareDisplayCaptureMessage = {
  type: "OFFSCREEN_PREPARE_DISPLAY_CAPTURE";
};

/**
 * Offscreen Document が保持中の事前取得 MediaStream（display モード）または
 * tabCapture の streamId（tab モード）を使って録画を開始する要求。
 *
 * - mode: "tab" の場合 streamId が必須
 * - mode: "display" の場合 streamId は不要（OFFSCREEN_PREPARE_DISPLAY_CAPTURE 済みのストリームを使う）
 */
type OffscreenStartRecordingMessage = {
  type: "OFFSCREEN_START_RECORDING";
  mode: RecordingMode;
  streamId?: string;
  recordingId: string;
  micEnabled: boolean;
  quality: VideoQuality;
};

type OffscreenStopRecordingMessage = {
  type: "OFFSCREEN_STOP_RECORDING";
};

/**
 * 事前取得した MediaStream を破棄する要求（display モードでカウントダウンキャンセル時など）。
 */
type OffscreenDiscardPreparedStreamMessage = {
  type: "OFFSCREEN_DISCARD_PREPARED_STREAM";
};

// =============================================
// Offscreen → Background
// =============================================

type RecordingStartedMessage = {
  type: "RECORDING_STARTED";
};

type RecordingErrorMessage = {
  type: "RECORDING_ERROR";
  error: string;
};

type UploadProgressMessage = {
  type: "UPLOAD_PROGRESS";
  progress: UploadProgress;
};

type VideoReadyMessage = {
  type: "VIDEO_READY";
  durationMs: number;
  fileSize: number;
};

/**
 * "display" モード時、ユーザーが Chrome の「共有を停止」ボタンや
 * 共有元ウィンドウのクローズで track が ended になった通知。
 * Background は STOP_RECORDING 同等のフローへ進める。
 */
type DisplayCaptureEndedMessage = {
  type: "DISPLAY_CAPTURE_ENDED";
};

// =============================================
// Background → Content Script（マイク権限）
// =============================================

type InjectMicPermissionIframeMessage = {
  type: "INJECT_MIC_PERMISSION_IFRAME";
  /** ワンタイムノンス（リクエストごとに生成）。mic-permission iframe がノンスを検証することで
   * 任意のウェブページから REQUEST_MIC_PERMISSION を偽装できないようにする。 */
  nonce: string;
};

// =============================================
// Background → Content Script
// =============================================

type ShowCountdownMessage = {
  type: "SHOW_COUNTDOWN";
};

type ShowRecordingIndicatorMessage = {
  type: "SHOW_RECORDING_INDICATOR";
  startTime: number;
};

type HideRecordingIndicatorMessage = {
  type: "HIDE_RECORDING_INDICATOR";
};

// =============================================
// Content Script → Background
// =============================================

type CountdownCompletedMessage = {
  type: "COUNTDOWN_COMPLETED";
};

type CountdownCancelledMessage = {
  type: "COUNTDOWN_CANCELLED";
};

type StopRecordingFromIndicatorMessage = {
  type: "STOP_RECORDING_FROM_INDICATOR";
};

// =============================================
// Content Script → Background（状態確認）
// =============================================

type QueryRecordingStateMessage = {
  type: "QUERY_RECORDING_STATE";
};

// =============================================
// Background → Offscreen（MIME タイプ検出）
// =============================================

type QueryMimeTypeMessage = {
  type: "QUERY_MIME_TYPE";
};

// =============================================
// mic-permission iframe → Background（nonce 検証）
// =============================================

/** mic-permission iframe が getUserMedia を呼ぶ前にバックグラウンドへ送る nonce 検証リクエスト。
 * バックグラウンドが発行した nonce のみが有効（一度使うと無効化）。
 * 悪意あるページが mic-permission.html を直接 iframe 埋め込みして
 * getUserMedia をトリガーする攻撃を防ぐ。 */
type ValidateMicNonceMessage = {
  type: "VALIDATE_MIC_NONCE";
  nonce: string;
};

// =============================================
// Offscreen → Background（キープアライブ）
// =============================================

/** MV3 Service Worker の強制終了を防ぐために Offscreen Document から
 * 定期的（20 秒ごと）に送信するピン。Background は何もせず受け取るだけ。 */
type KeepaliveMessage = {
  type: "KEEPALIVE";
};

// =============================================
// Union 型
// =============================================

export type ExtensionMessage =
  // Popup → Background
  | StartRecordingMessage
  | StopRecordingMessage
  // Background → Offscreen
  | OffscreenPrepareDisplayCaptureMessage
  | OffscreenStartRecordingMessage
  | OffscreenStopRecordingMessage
  | OffscreenDiscardPreparedStreamMessage
  | QueryMimeTypeMessage
  // Offscreen → Background
  | RecordingStartedMessage
  | RecordingErrorMessage
  | UploadProgressMessage
  | VideoReadyMessage
  | DisplayCaptureEndedMessage
  | KeepaliveMessage
  // Background → Content Script
  | InjectMicPermissionIframeMessage
  | ShowCountdownMessage
  | ShowRecordingIndicatorMessage
  | HideRecordingIndicatorMessage
  // Content Script → Background
  | CountdownCompletedMessage
  | CountdownCancelledMessage
  | StopRecordingFromIndicatorMessage
  | QueryRecordingStateMessage
  // mic-permission iframe → Background
  | ValidateMicNonceMessage;
