import {
  type AudioSettings,
  INITIAL_RECORDING_STATE,
  type ModeSettings,
  type QualitySettings,
  type RecordingState,
} from "../types/recording";

/**
 * 録画状態（local storage — ブラウザ再起動後も永続）
 * Background, Popup, Content Script から読み書きされる。
 */
export const recordingStateStorage = storage.defineItem<RecordingState>(
  "local:recordingState",
  { defaultValue: INITIAL_RECORDING_STATE },
);

/**
 * オーディオ設定（local storage — ユーザー設定として永続）
 * Popup でユーザーが切り替え、Background が読み取る。
 * 初回デフォルトは false: 初回ユーザーが事前説明なしにマイク権限ダイアログに
 * 遭遇しないようにするため。ユーザーが有効にすれば以降は設定が永続される。
 */
export const audioSettingsStorage = storage.defineItem<AudioSettings>(
  "local:audioSettings",
  { defaultValue: { micEnabled: false } },
);

/**
 * 品質設定（local storage — ユーザー設定として永続）
 * Popup でユーザーが選択し、Background 経由で Offscreen Document に渡される。
 */
export const qualitySettingsStorage = storage.defineItem<QualitySettings>(
  "local:qualitySettings",
  { defaultValue: { quality: "high" } },
);

/**
 * 録画モード設定（local storage — ユーザー設定として永続）
 * Popup でユーザーが切り替え、Background が読み取る。
 * 既存ユーザーの体験を変えないよう、初期値は "tab"。
 */
export const modeSettingsStorage = storage.defineItem<ModeSettings>(
  "local:modeSettings",
  { defaultValue: { mode: "tab" } },
);
