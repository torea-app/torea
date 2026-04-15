import { recordingApi } from "../lib/api";
import {
  COUNTDOWN_TIMEOUT_MS,
  ERROR_MESSAGES,
  WEB_URL,
} from "../lib/constants";
import { recordingStateStorage } from "../lib/storage";
import type { ExtensionMessage } from "../types/message";
import { INITIAL_RECORDING_STATE, type VideoQuality } from "../types/recording";

// =============================================
// マイク権限 nonce 管理（SEC-3）
// =============================================

/**
 * Background が発行した有効な nonce を管理する。
 * 値は有効期限のタイムスタンプ（Date.now() + TTL）。
 *
 * セキュリティ設計:
 * - nonce は Background のみが生成・記録する
 * - mic-permission iframe が getUserMedia 前に VALIDATE_MIC_NONCE で検証を要求する
 * - 一致した nonce は即座に削除（使い捨て）
 * - TTL 超過した nonce は検証時に自動拒否
 * → 攻撃者が任意の nonce で mic-permission.html を直接 iframe 埋め込みしても
 *   Background の台帳に登録されていないため拒否される
 */
const pendingMicNonces = new Map<string, number>();
const MIC_NONCE_TTL_MS = 60_000; // 1 分（マイク権限ダイアログの操作に十分な時間）

function registerMicNonce(nonce: string): void {
  // 期限切れノンスを先に掃除してメモリリークを防ぐ
  const now = Date.now();
  for (const [key, expiry] of pendingMicNonces) {
    if (now >= expiry) pendingMicNonces.delete(key);
  }
  pendingMicNonces.set(nonce, now + MIC_NONCE_TTL_MS);
}

function validateAndConsumeMicNonce(nonce: string): boolean {
  const expiry = pendingMicNonces.get(nonce);
  if (expiry === undefined) return false;
  pendingMicNonces.delete(nonce); // 使い捨て
  return Date.now() < expiry;
}

// =============================================
// Offscreen Document 管理
// =============================================

let creatingOffscreen: Promise<void> | null = null;

/**
 * Offscreen Document が存在しなければ作成する。
 * 同時に複数回呼ばれても1つだけ作成する。
 */
async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = browser.runtime.getURL("/recorder.html");

  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = browser.offscreen
    .createDocument({
      url: offscreenUrl,
      reasons: ["USER_MEDIA"],
      justification: "Recording tab audio and video via MediaRecorder",
    })
    .finally(() => {
      creatingOffscreen = null;
    });

  await creatingOffscreen;
}

/** Offscreen Document を閉じる（エラーは無視） */
async function closeOffscreenDocument(): Promise<void> {
  try {
    await browser.offscreen.closeDocument();
  } catch {
    // 既に閉じている場合は無視
  }
}

// =============================================
// マイク権限
// =============================================

/**
 * Content Script 経由で現在のタブに iframe を注入し、マイク権限を確保する。
 *
 * Offscreen Document / Background / Popup からは Chrome がパーミッションダイアログを
 * 表示しないため、visible context（現在のタブ）に
 * <iframe allow="microphone *"> を埋め込んで getUserMedia を呼ぶ。
 */
async function ensureMicrophonePermission(tabId: number): Promise<boolean> {
  // まずサービスワーカー側で現在の権限状態を確認
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (status.state === "granted") return true;
    if (status.state === "denied") return false;
  } catch {
    // permissions.query が未サポートの環境では無視してダイアログ表示を試みる
  }

  // "prompt" 状態 → Content Script 経由で iframe を注入してダイアログを表示
  // nonce はリクエストごとに生成し Background の台帳に登録する（SEC-3）。
  // mic-permission iframe は getUserMedia 前に Background へ nonce 検証を要求するため、
  // Background が発行した nonce のみが有効になる。
  const nonce = crypto.randomUUID();
  registerMicNonce(nonce);
  try {
    const response = await browser.tabs.sendMessage(tabId, {
      type: "INJECT_MIC_PERMISSION_IFRAME",
      nonce,
    } satisfies ExtensionMessage);
    return (response as { granted?: boolean })?.granted ?? false;
  } catch (e) {
    console.error(
      "[ScreenBase] ensureMicrophonePermission: sendMessage failed",
      e,
    );
    return false;
  }
}

// =============================================
// 録画開始
// =============================================

/**
 * 録画開始の全フローを実行する。
 * 0. マイク権限確認（必要な場合）
 * 1. タブ情報取得
 * 2. Offscreen Document 作成（MIME タイプ検出のため早期作成）
 * 3. MIME タイプ検出
 * 4. 録画レコード作成（正確な MIME タイプを使用）
 * 5. カウントダウン
 * 6. Tab Capture Stream ID 取得
 * 7. Offscreen Document で録画開始
 */
async function handleStartRecording(
  micEnabled: boolean,
  quality: VideoQuality,
): Promise<void> {
  // --- 1. アクティブタブの取得 ---
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    throw new Error(ERROR_MESSAGES.TAB_CAPTURE_FAILED);
  }

  const tabId = activeTab.id;
  const tabTitle = activeTab.title ?? undefined;

  // --- 2. マイク権限を確認（サーバー呼び出し前に行うことで無駄な API 呼び出しを防ぐ） ---
  if (micEnabled) {
    // ユーザーに対してマイク許可ダイアログを表示する可能性があるため、
    // ポップアップ側にフィードバックを与えるため requesting_mic 状態をセットする。
    await recordingStateStorage.setValue({
      ...INITIAL_RECORDING_STATE,
      uploadStatus: "requesting_mic",
    });
    const granted = await ensureMicrophonePermission(tabId);
    if (!granted) {
      await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
      throw new Error(ERROR_MESSAGES.MIC_PERMISSION_DENIED);
    }
    // 権限取得後は idle に戻してから後続処理へ
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
  }

  // --- 3. Offscreen Document を早期作成（MIME タイプ検出に使用） ---
  try {
    await ensureOffscreenDocument();
  } catch (e) {
    console.error("[ScreenBase] Step3: offscreen creation failed", e);
    throw new Error(ERROR_MESSAGES.OFFSCREEN_CREATION_FAILED);
  }

  // --- 4. Offscreen Document から実際にサポートされる MIME タイプを取得 ---
  let mimeType = "video/mp4";
  try {
    const mimeTypeResponse = await browser.runtime.sendMessage({
      type: "QUERY_MIME_TYPE",
    } satisfies ExtensionMessage);
    mimeType =
      (mimeTypeResponse as { mimeType?: string })?.mimeType ?? "video/mp4";
  } catch {
    // Offscreen が応答しない場合は "video/mp4" を維持
  }

  // --- 5. サーバーに録画レコードを作成（正確な MIME タイプを渡す） ---
  let recordingId: string;
  try {
    const result = await recordingApi.create({ title: tabTitle, mimeType });
    recordingId = result.id;
  } catch (error) {
    await closeOffscreenDocument();
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.SERVER_ERROR;
    throw new Error(message);
  }

  // --- 6. 初期状態を保存 ---
  await recordingStateStorage.setValue({
    isRecording: false,
    recordingId,
    tabId,
    startTime: null,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 7. カウントダウン表示 ---
  try {
    await showCountdownAndWait(tabId);
  } catch {
    // キャンセルまたはエラー → 録画を中止
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    return;
  }

  // --- 8. Tab Capture Stream ID 取得 ---
  let streamId: string;
  try {
    streamId = await browser.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });
  } catch (e) {
    console.error("[ScreenBase] Step8: tabCapture.getMediaStreamId failed", e);
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    throw new Error(ERROR_MESSAGES.TAB_CAPTURE_FAILED);
  }

  // --- 9. Offscreen Document で録画開始（既に作成済み） ---
  let offscreenResponse: { success: boolean; error?: string } | undefined;
  try {
    offscreenResponse = await browser.runtime.sendMessage({
      type: "OFFSCREEN_START_RECORDING",
      streamId,
      recordingId,
      micEnabled,
      quality,
    } satisfies ExtensionMessage);
  } catch (e) {
    console.error("[ScreenBase] Step9: sendMessage to offscreen failed", e);
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    throw new Error(ERROR_MESSAGES.RECORDING_START_FAILED);
  }

  if (!offscreenResponse?.success) {
    console.error(
      "[ScreenBase] Step9: offscreen returned failure",
      offscreenResponse?.error,
    );
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    throw new Error(
      offscreenResponse?.error ?? ERROR_MESSAGES.RECORDING_START_FAILED,
    );
  }

  // --- 10. 録画開始状態を保存 ---
  const startTime = Date.now();
  await recordingStateStorage.setValue({
    isRecording: true,
    recordingId,
    tabId,
    startTime,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 11. 録画インジケーターを表示 ---
  browser.tabs
    .sendMessage(tabId, {
      type: "SHOW_RECORDING_INDICATOR",
      startTime,
    } satisfies ExtensionMessage)
    .catch(() => {
      // コンテンツスクリプトが未ロードの場合は無視
    });
}

// =============================================
// Content Script 注入
// =============================================

/**
 * 対象タブに Content Script が注入されていることを保証する。
 *
 * manifest.json の content_scripts はページ読み込み時にのみ注入されるため、
 * 拡張機能のインストール/リロード後に既に開いていたタブには Content Script が存在しない。
 * browser.scripting.executeScript で明示的に注入することで、この問題を回避する。
 * 既に注入済みの場合は二重実行されるが、WXT の Content Script は冪等に設計されているため安全。
 */
async function ensureContentScriptsInjected(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [
        "content-scripts/countdown.js",
        "content-scripts/recording-indicator.js",
      ],
    });
  } catch (e) {
    // chrome://, edge://, about: など注入不可のページではエラーになる
    console.warn(
      "[ScreenBase] Content script injection failed (restricted page?)",
      e,
    );
    throw new Error("Content script not available");
  }
}

// =============================================
// カウントダウン
// =============================================

/**
 * タブにカウントダウンを表示し、完了またはキャンセルを待つ。
 * キャンセルされた場合は例外をスローする。
 *
 * セキュリティ: sender.tab?.id でメッセージ送信元タブを検証し、
 * 録画対象タブ以外からの COUNTDOWN_COMPLETED/CANCELLED を無視する。
 *
 * 信頼性: COUNTDOWN_TIMEOUT_MS 経過後にタイムアウトし、
 * コンテンツスクリプトのクラッシュやタブのサスペンドによる無限待機を防ぐ。
 */
async function showCountdownAndWait(tabId: number): Promise<void> {
  // Content Script が未注入の場合に備えてプログラム的に注入する
  await ensureContentScriptsInjected(tabId);

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function cleanup() {
      clearTimeout(timeoutId);
      browser.runtime.onMessage.removeListener(messageListener);
    }

    function messageListener(
      message: ExtensionMessage,
      sender: { tab?: { id?: number } },
    ) {
      // 録画対象タブ以外からのメッセージは無視する
      if (sender.tab?.id !== tabId) return;

      if (message.type === "COUNTDOWN_COMPLETED") {
        cleanup();
        resolve();
      } else if (message.type === "COUNTDOWN_CANCELLED") {
        cleanup();
        reject(new Error("Cancelled"));
      }
    }

    browser.runtime.onMessage.addListener(messageListener);

    // タイムアウト: コンテンツスクリプトがクラッシュ・タブがサスペンドされた場合に備える
    timeoutId = setTimeout(() => {
      browser.runtime.onMessage.removeListener(messageListener);
      reject(new Error("Countdown timed out"));
    }, COUNTDOWN_TIMEOUT_MS);

    // カウントダウン開始メッセージをタブに送信
    browser.tabs
      .sendMessage(tabId, {
        type: "SHOW_COUNTDOWN",
      } satisfies ExtensionMessage)
      .catch(() => {
        cleanup();
        reject(new Error("Content script not available"));
      });
  });
}

// =============================================
// 録画停止
// =============================================

async function handleStopRecording(): Promise<void> {
  const state = await recordingStateStorage.getValue();
  if (!state?.isRecording) return;

  // 録画インジケーターを非表示
  if (state.tabId) {
    browser.tabs
      .sendMessage(state.tabId, {
        type: "HIDE_RECORDING_INDICATOR",
      } satisfies ExtensionMessage)
      .catch(() => {});
  }

  // Offscreen Document に停止指示
  await browser.runtime.sendMessage({
    type: "OFFSCREEN_STOP_RECORDING",
  } satisfies ExtensionMessage);

  // completing 状態に更新
  await recordingStateStorage.setValue({
    ...state,
    isRecording: false,
    uploadStatus: "completing",
  });
}

// =============================================
// 録画完了 / エラーハンドリング
// =============================================

/** Offscreen Document から VIDEO_READY を受信した時の処理 */
async function handleVideoReady(): Promise<void> {
  const state = await recordingStateStorage.getValue();

  // 録画詳細ページを新タブで開く
  if (state?.recordingId) {
    browser.tabs
      .create({
        url: `${WEB_URL}/dashboard/recordings/${state.recordingId}`,
      })
      .catch(() => {});
  }

  // 即座にアイドル状態に戻す（新タブが確認の役割を果たす）
  await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
  await closeOffscreenDocument();
}

/** 録画エラー発生時の処理 */
async function handleRecordingError(errorMessage: string): Promise<void> {
  const state = await recordingStateStorage.getValue();

  // "uploading"（録画中）と "completing"（最終アップロード中）の両方で abort する。
  // completing 中に finalizeRecording() が失敗した場合、R2 の不完全なマルチパート
  // アップロードが残るため、確実に abort して R2 上のリソースを解放する。
  if (
    state?.recordingId &&
    (state.uploadStatus === "uploading" || state.uploadStatus === "completing")
  ) {
    await recordingApi.abort(state.recordingId).catch(() => {});
  }

  await recordingStateStorage.setValue({
    ...INITIAL_RECORDING_STATE,
    uploadStatus: "error",
    errorMessage,
  });

  // インジケーターを非表示
  if (state?.tabId) {
    browser.tabs
      .sendMessage(state.tabId, {
        type: "HIDE_RECORDING_INDICATOR",
      } satisfies ExtensionMessage)
      .catch(() => {});
  }

  await closeOffscreenDocument();
}

// =============================================
// タブ閉じ検知
// =============================================

browser.tabs.onRemoved.addListener(async (closedTabId) => {
  const state = await recordingStateStorage.getValue();
  if (state?.isRecording && state.tabId === closedTabId) {
    // 録画中のタブが閉じられた → 録画を停止
    await handleStopRecording();
  }
});

// =============================================
// 起動時リカバリー
// =============================================

async function recoverFromCrash(): Promise<void> {
  const state = await recordingStateStorage.getValue();
  if (!state) return;

  // 前回のセッションが異常終了した場合のクリーンアップ
  // "completing" も対象に含める（最終アップロード中のクラッシュも検出する）
  if (
    state.isRecording ||
    state.uploadStatus === "requesting_mic" ||
    state.uploadStatus === "uploading" ||
    state.uploadStatus === "completing"
  ) {
    if (state.recordingId) {
      await recordingApi.abort(state.recordingId).catch(() => {});
    }
    await recordingStateStorage.setValue({
      ...INITIAL_RECORDING_STATE,
      uploadStatus: "error",
      errorMessage: "前回の録画が正常に終了しませんでした",
    });
    await closeOffscreenDocument();
  }
}

// =============================================
// メッセージルーティング
// =============================================

browser.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      // --- Popup → Background ---
      case "START_RECORDING": {
        handleStartRecording(message.micEnabled, message.quality)
          .then(() => sendResponse({ success: true }))
          .catch(async (error: unknown) => {
            const errorMessage =
              error instanceof Error
                ? error.message
                : ERROR_MESSAGES.RECORDING_START_FAILED;
            // ポップアップが閉じていても状態にエラーを反映する
            await recordingStateStorage.setValue({
              ...INITIAL_RECORDING_STATE,
              uploadStatus: "error",
              errorMessage,
            });
            sendResponse({ success: false, error: errorMessage });
          });
        return true; // 非同期レスポンス
      }

      case "STOP_RECORDING": {
        handleStopRecording()
          .then(() => sendResponse({ success: true }))
          .catch(() =>
            sendResponse({
              success: false,
              error: ERROR_MESSAGES.RECORDING_STOP_FAILED,
            }),
          );
        return true;
      }

      // --- Offscreen → Background ---
      case "RECORDING_STARTED":
        // 既に handleStartRecording 内で状態更新済み
        return false;

      case "VIDEO_READY":
        handleVideoReady();
        return false;

      case "RECORDING_ERROR":
        handleRecordingError(message.error);
        return false;

      case "UPLOAD_PROGRESS":
        // アップロード進捗を RecordingState に保存して Popup で表示できるようにする（UX-4）
        recordingStateStorage.getValue().then((state) => {
          if (
            state &&
            (state.isRecording || state.uploadStatus === "completing")
          ) {
            recordingStateStorage.setValue({
              ...state,
              uploadedBytes: message.progress.uploadedBytes,
            });
          }
        });
        return false;

      case "KEEPALIVE":
        // Offscreen Document からの定期ピン。受け取るだけで SW がアクティブに保たれる。
        return false;

      // --- Content Script → Background ---
      case "STOP_RECORDING_FROM_INDICATOR":
        // 録画中のタブからのメッセージのみ受け付ける（SEC-1）
        // 他タブのコンテンツスクリプトが録画を不正停止できないようにする
        recordingStateStorage.getValue().then((state) => {
          if (state?.isRecording && sender.tab?.id === state.tabId) {
            handleStopRecording();
          }
        });
        return false;

      case "QUERY_RECORDING_STATE":
        recordingStateStorage.getValue().then((state) => {
          sendResponse(state);
        });
        return true;

      // --- mic-permission iframe → Background ---
      case "VALIDATE_MIC_NONCE": {
        // Background が発行した nonce のみ有効（SEC-3）
        // 一致した nonce は即座に削除（使い捨て）
        const valid = validateAndConsumeMicNonce(message.nonce);
        sendResponse({ valid });
        return false;
      }

      default:
        return false;
    }
  },
);

// =============================================
// 初期化
// =============================================

export default defineBackground(async () => {
  // クラッシュリカバリーをメッセージハンドラ登録後に完了させる
  await recoverFromCrash();
});
