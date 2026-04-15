import type { UploadProgress, VideoQuality } from "./recording";

// =============================================
// Popup → Background
// =============================================

type StartRecordingMessage = {
  type: "START_RECORDING";
  micEnabled: boolean;
  quality: VideoQuality;
};

type StopRecordingMessage = {
  type: "STOP_RECORDING";
};

// =============================================
// Background → Offscreen
// =============================================

type OffscreenStartRecordingMessage = {
  type: "OFFSCREEN_START_RECORDING";
  streamId: string;
  recordingId: string;
  micEnabled: boolean;
  quality: VideoQuality;
};

type OffscreenStopRecordingMessage = {
  type: "OFFSCREEN_STOP_RECORDING";
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
  | OffscreenStartRecordingMessage
  | OffscreenStopRecordingMessage
  | QueryMimeTypeMessage
  // Offscreen → Background
  | RecordingStartedMessage
  | RecordingErrorMessage
  | UploadProgressMessage
  | VideoReadyMessage
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
