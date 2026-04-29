/** 録画品質プリセット */
export type VideoQuality = "ultra" | "high" | "medium" | "low";

/** 品質設定 */
export type QualitySettings = {
  quality: VideoQuality;
};

/**
 * 録画モード。
 * - "tab": tabCapture でアクティブタブのみを録画する（既存挙動）
 * - "display": getDisplayMedia で Chrome の共有ピッカーを開き、
 *   画面 / ウィンドウ / タブのいずれかをユーザーに選ばせる
 */
export type RecordingMode = "tab" | "display";

/** モード設定 */
export type ModeSettings = {
  mode: RecordingMode;
};

/** 録画の状態（WXT Storage に保存） */
export type RecordingState = {
  /** 録画中かどうか */
  isRecording: boolean;
  /** サーバー上の録画 ID */
  recordingId: string | null;
  /** 録画モード */
  mode: RecordingMode;
  /** 録画対象タブ ID（"tab" モードのみ。"display" モードでは null） */
  tabId: number | null;
  /** UI（カウントダウン / 録画中インジケーター）を表示するタブ ID。
   * "tab" モードでは tabId と同じ。"display" モードでは録画開始時のアクティブタブ。 */
  uiTabId: number | null;
  /** 録画開始時刻（Date.now()） */
  startTime: number | null;
  /** アップロードステータス */
  uploadStatus:
    | "idle"
    | "requesting_mic"
    | "selecting_source"
    | "uploading"
    | "completing"
    | "completed"
    | "error";
  /** エラーメッセージ */
  errorMessage: string | null;
  /** アップロード済みバイト数（completing フェーズの進捗表示用）。
   * UPLOAD_PROGRESS 受信時に更新される。null = 進捗不明。 */
  uploadedBytes: number | null;
};

/** 録画状態の初期値 */
export const INITIAL_RECORDING_STATE: RecordingState = {
  isRecording: false,
  recordingId: null,
  mode: "tab",
  tabId: null,
  uiTabId: null,
  startTime: null,
  uploadStatus: "idle",
  errorMessage: null,
  uploadedBytes: null,
};

/** オーディオ設定 */
export type AudioSettings = {
  /** マイク有効 */
  micEnabled: boolean;
};

/** アップロード進捗 */
export type UploadProgress = {
  /** アップロード済みバイト数 */
  uploadedBytes: number;
  /** アップロード済みパート数 */
  uploadedParts: number;
};

/** アップロード済みパート情報 */
export type UploadedPart = {
  partNumber: number;
  etag: string;
};
