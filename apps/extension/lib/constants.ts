import type { VideoQuality } from "../types/recording";

/** 品質プリセットの定義 */
export type QualityPreset = {
  /** 表示名 */
  label: string;
  /** 説明（解像度・フレームレート・ビットレート） */
  description: string;
  /** 映像幅 */
  videoWidth: number;
  /** 映像高さ */
  videoHeight: number;
  /** フレームレート */
  frameRate: number;
  /** 映像ビットレート（bps） */
  videoBitrate: number;
  /** 音声ビットレート（bps） */
  audioBitrate: number;
};

/** 品質プリセット */
export const QUALITY_PRESETS: Record<VideoQuality, QualityPreset> = {
  ultra: {
    label: "最高画質",
    description: "3840×2160 / 30fps / 5Mbps",
    videoWidth: 3840,
    videoHeight: 2160,
    frameRate: 30,
    videoBitrate: 5_000_000,
    audioBitrate: 320_000,
  },
  high: {
    label: "高画質",
    description: "1920×1080 / 30fps / 5Mbps",
    videoWidth: 1920,
    videoHeight: 1080,
    frameRate: 30,
    videoBitrate: 5_000_000,
    audioBitrate: 128_000,
  },
  medium: {
    label: "標準",
    description: "1280×720 / 30fps / 2.5Mbps",
    videoWidth: 1280,
    videoHeight: 720,
    frameRate: 30,
    videoBitrate: 2_500_000,
    audioBitrate: 128_000,
  },
  low: {
    label: "軽量",
    description: "1280×720 / 15fps / 1Mbps",
    videoWidth: 1280,
    videoHeight: 720,
    frameRate: 15,
    videoBitrate: 1_000_000,
    audioBitrate: 64_000,
  },
};

/** 品質プリセットの表示順（高品質→低品質） */
export const QUALITY_PRESET_ORDER: VideoQuality[] = [
  "ultra",
  "high",
  "medium",
  "low",
];

/** 録画設定（品質非依存） */
export const RECORDING = {
  /** MediaRecorder の ondataavailable 発火間隔（ミリ秒）。
   * 5Mbps (Ultra/High) × 8秒 = 5MB = MIN_PART_SIZE_BYTES と一致するため、
   * 最高ビットレート時は 1チャンク = 1パートで直接アップロードに移行でき、
   * 中間バッファリングと Blob 分割処理を回避する。 */
  CHUNK_INTERVAL_MS: 8000,
  /** R2 multipart upload のパートあたり最小サイズ（バイト） */
  MIN_PART_SIZE_BYTES: 5 * 1024 * 1024,
  /** パート番号の上限 */
  MAX_PART_NUMBER: 10000,
  /** UploadManager のバッファ上限（バイト）: ネットワーク遅延時のメモリ保護 */
  MAX_BUFFER_BYTES: 50 * 1024 * 1024,
} as const;

/** カウントダウン秒数 */
export const COUNTDOWN_SECONDS = 3;

/** カウントダウンタイムアウト（ミリ秒）。
 * コンテンツスクリプトのクラッシュやタブのサスペンドで Promise が永久にハングするのを防ぐ。
 * COUNTDOWN_SECONDS + 十分なバッファを確保する。 */
export const COUNTDOWN_TIMEOUT_MS = (COUNTDOWN_SECONDS + 10) * 1000;

/** リトライ設定 */
export const RETRY = {
  MAX_ATTEMPTS: 5,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

/** エラーメッセージ */
export const ERROR_MESSAGES = {
  TAB_CAPTURE_FAILED:
    "このページは録画できません（chrome:// や拡張機能ページは対象外です）",
  MIC_PERMISSION_DENIED:
    "マイクへのアクセスが拒否されています。ブラウザの設定から拡張機能のマイク権限を許可してください",
  MIC_NOT_FOUND:
    "マイクデバイスが見つかりません。マイクが接続されているか確認してください",
  MIC_IN_USE:
    "マイクが他のアプリケーションで使用中です。他のアプリを閉じてから再試行してください",
  RECORDING_START_FAILED: "録画の開始に失敗しました",
  RECORDING_STOP_FAILED: "録画の停止に失敗しました",
  UPLOAD_FAILED:
    "アップロードに失敗しました。ネットワーク接続を確認してください",
  SERVER_ERROR:
    "サーバーとの通信に失敗しました。しばらく待ってから再試行してください",
  NOT_AUTHENTICATED: "ログインが必要です",
  OFFSCREEN_CREATION_FAILED: "録画環境の準備に失敗しました",
  BUFFER_OVERFLOW:
    "ネットワークが遅いため録画バッファが上限を超えました。録画を停止します。ネットワーク環境を改善するか、低画質モードをお試しください。",
  DISPLAY_CAPTURE_CANCELLED: "画面の選択がキャンセルされました",
  DISPLAY_CAPTURE_DENIED:
    "画面録画の権限が拒否されました。OS の設定で Chrome に画面収録権限を付与してください",
  DISPLAY_CAPTURE_FAILED: "画面の取得に失敗しました",
  MIC_PROMPT_BLOCKED:
    "マイク権限のリクエストにアクティブな http(s) タブが必要です。マイクをオフにするか、通常のページを開いた状態で再試行してください",
} as const;

/** Web ダッシュボードの URL
 * 開発時は .env の VITE_WEB_URL を使用し、未設定の場合は本番 URL にフォールバックする。
 * 誤って dev サーバーへ繋がることを防ぐため、フォールバックは本番 URL にする。 */
export const WEB_URL = import.meta.env.VITE_WEB_URL ?? "https://torea.app";
