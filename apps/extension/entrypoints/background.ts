import { recordingApi } from "../lib/api";
import {
  COUNTDOWN_TIMEOUT_MS,
  ERROR_MESSAGES,
  WEB_URL,
} from "../lib/constants";
import { computeEffectiveLimitMs, fetchPlanGuard } from "../lib/plan-guard";
import { recordingStateStorage } from "../lib/storage";
import type { ExtensionMessage } from "../types/message";
import {
  INITIAL_RECORDING_STATE,
  type RecordingMode,
  type VideoQuality,
} from "../types/recording";

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
      // USER_MEDIA: tabCapture / マイク音声取得
      // DISPLAY_MEDIA: getDisplayMedia による画面・ウィンドウ録画
      reasons: ["USER_MEDIA", "DISPLAY_MEDIA"],
      justification:
        "Recording tab/window/screen audio and video via MediaRecorder",
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
    console.error("[Torea] ensureMicrophonePermission: sendMessage failed", e);
    return false;
  }
}

// =============================================
// 録画開始
// =============================================

/**
 * 録画開始の全フローを実行する。
 *
 * モード別の主な違い:
 * - "tab" モード: tabCapture.getMediaStreamId でアクティブタブを録画。
 *   録画対象タブ ＝ UI 表示タブ。
 * - "display" モード: Offscreen 内で getDisplayMedia を呼んで Chrome のピッカーを開く。
 *   ピッカー呼び出しは popup の user gesture を消費する前（Mic 権限ダイアログより前）に
 *   行う必要がある（gesture 失効を避けるため）。録画対象＝ピッカーで選んだソース、
 *   UI 表示は録画開始時のアクティブタブ。
 */
async function handleStartRecording(
  mode: RecordingMode,
  micEnabled: boolean,
  quality: VideoQuality,
): Promise<void> {
  // --- 0. プラン情報を取得し、自動停止までの時間（effectiveLimitMs）を計算 ---
  // 失敗時は undefined（自動停止しない）。サーバー側でも上限超過時は 402 で
  // 弾かれるので、フェッチ失敗 = 録画させないにはしない。
  const planGuard = await fetchPlanGuard();
  const effectiveLimitMs = planGuard
    ? computeEffectiveLimitMs(planGuard)
    : undefined;

  // --- 1. アクティブタブの取得（UI 表示用 + tab モードでは録画対象） ---
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!activeTab?.id) {
    throw new Error(ERROR_MESSAGES.TAB_CAPTURE_FAILED);
  }

  const uiTabId = activeTab.id;
  const activeTabTitle = activeTab.title ?? undefined;

  if (mode === "display") {
    await handleStartDisplayRecording({
      uiTabId,
      activeTabTitle,
      micEnabled,
      quality,
      effectiveLimitMs,
    });
  } else {
    await handleStartTabRecording({
      tabId: uiTabId,
      tabTitle: activeTabTitle,
      micEnabled,
      quality,
      effectiveLimitMs,
    });
  }
}

// =============================================
// tab モード: 既存フロー
// =============================================

async function handleStartTabRecording({
  tabId,
  tabTitle,
  micEnabled,
  quality,
  effectiveLimitMs,
}: {
  tabId: number;
  tabTitle: string | undefined;
  micEnabled: boolean;
  quality: VideoQuality;
  effectiveLimitMs: number | undefined;
}): Promise<void> {
  // --- 1. マイク権限を確認（サーバー呼び出し前に行うことで無駄な API 呼び出しを防ぐ） ---
  if (micEnabled) {
    // ユーザーに対してマイク許可ダイアログを表示する可能性があるため、
    // ポップアップ側にフィードバックを与えるため requesting_mic 状態をセットする。
    await recordingStateStorage.setValue({
      ...INITIAL_RECORDING_STATE,
      mode: "tab",
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

  // --- 2. Offscreen Document を早期作成（MIME タイプ検出に使用） ---
  try {
    await ensureOffscreenDocument();
  } catch (e) {
    console.error("[Torea] tab: offscreen creation failed", e);
    throw new Error(ERROR_MESSAGES.OFFSCREEN_CREATION_FAILED);
  }

  // --- 3. Offscreen Document から実際にサポートされる MIME タイプを取得 ---
  const mimeType = await queryOffscreenMimeType();

  // --- 4. サーバーに録画レコードを作成 ---
  let recordingId: string;
  try {
    const result = await recordingApi.create({
      title: tabTitle,
      mimeType,
      quality,
    });
    recordingId = result.id;
  } catch (error) {
    await closeOffscreenDocument();
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.SERVER_ERROR;
    throw new Error(message);
  }

  // --- 5. 初期状態を保存 ---
  await recordingStateStorage.setValue({
    isRecording: false,
    recordingId,
    mode: "tab",
    tabId,
    uiTabId: tabId,
    startTime: null,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 6. カウントダウン表示 ---
  try {
    await showCountdownAndWait(tabId);
  } catch {
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    return;
  }

  // --- 7. Tab Capture Stream ID 取得 ---
  let streamId: string;
  try {
    streamId = await browser.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });
  } catch (e) {
    console.error("[Torea] tab: tabCapture.getMediaStreamId failed", e);
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    throw new Error(ERROR_MESSAGES.TAB_CAPTURE_FAILED);
  }

  // --- 8. Offscreen Document で録画開始 ---
  await sendStartRecordingToOffscreen({
    mode: "tab",
    streamId,
    recordingId,
    micEnabled,
    quality,
    effectiveLimitMs,
  });

  // --- 9. 録画開始状態を保存 ---
  const startTime = Date.now();
  await recordingStateStorage.setValue({
    isRecording: true,
    recordingId,
    mode: "tab",
    tabId,
    uiTabId: tabId,
    startTime,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 10. 録画インジケーターを表示 ---
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
// display モード: getDisplayMedia フロー
// =============================================

async function handleStartDisplayRecording({
  uiTabId,
  activeTabTitle,
  micEnabled,
  quality,
  effectiveLimitMs,
}: {
  uiTabId: number;
  activeTabTitle: string | undefined;
  micEnabled: boolean;
  quality: VideoQuality;
  effectiveLimitMs: number | undefined;
}): Promise<void> {
  // --- 1. Offscreen Document を作成（getDisplayMedia の呼び出し先） ---
  // popup → SW → offscreen のメッセージチェーンで user gesture が伝播するため、
  // これらは可能な限り await を挟まずに連続で行う。
  try {
    await ensureOffscreenDocument();
  } catch (e) {
    console.error("[Torea] display: offscreen creation failed", e);
    throw new Error(ERROR_MESSAGES.OFFSCREEN_CREATION_FAILED);
  }

  // popup 側にもフィードバックを与えるため selecting_source 状態をセット
  await recordingStateStorage.setValue({
    ...INITIAL_RECORDING_STATE,
    mode: "display",
    uiTabId,
    uploadStatus: "selecting_source",
  });

  // --- 2. Chrome ピッカーを開いて MediaStream を事前取得 ---
  let displayCaptureResult:
    | {
        ok: boolean;
        displaySurface?: string;
        label?: string;
        error?: string;
      }
    | undefined;
  try {
    displayCaptureResult = await browser.runtime.sendMessage({
      type: "OFFSCREEN_PREPARE_DISPLAY_CAPTURE",
    } satisfies ExtensionMessage);
  } catch (e) {
    console.error(
      "[Torea] display: sendMessage to offscreen (prepare) failed",
      e,
    );
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    throw new Error(ERROR_MESSAGES.DISPLAY_CAPTURE_FAILED);
  }

  if (!displayCaptureResult?.ok) {
    // ユーザーがピッカーをキャンセルした場合は静かに idle に戻す
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    const errMessage =
      displayCaptureResult?.error ?? ERROR_MESSAGES.DISPLAY_CAPTURE_FAILED;
    if (errMessage === ERROR_MESSAGES.DISPLAY_CAPTURE_CANCELLED) {
      // キャンセルは「エラー」扱いせず、idle 復帰だけで終わる
      return;
    }
    throw new Error(errMessage);
  }

  // --- 3. マイク権限（必要な場合） ---
  if (micEnabled) {
    await recordingStateStorage.setValue({
      ...INITIAL_RECORDING_STATE,
      mode: "display",
      uiTabId,
      uploadStatus: "requesting_mic",
    });
    const granted = await ensureMicrophonePermissionForDisplay(uiTabId);
    if (!granted) {
      await discardDisplayCaptureStream();
      await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
      await closeOffscreenDocument();
      throw new Error(ERROR_MESSAGES.MIC_PERMISSION_DENIED);
    }
  }

  // --- 4. MIME タイプ検出 ---
  const mimeType = await queryOffscreenMimeType();

  // --- 5. サーバーに録画レコードを作成 ---
  // タイトルは getDisplayMedia の track label を優先（"window: Some App" など）。
  // 取得できない場合は録画開始時のアクティブタブ名にフォールバック。
  const title =
    displayCaptureResult.label && displayCaptureResult.label.length > 0
      ? displayCaptureResult.label
      : activeTabTitle;

  let recordingId: string;
  try {
    const result = await recordingApi.create({ title, mimeType, quality });
    recordingId = result.id;
  } catch (error) {
    await discardDisplayCaptureStream();
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.SERVER_ERROR;
    throw new Error(message);
  }

  // --- 6. 初期状態を保存 ---
  await recordingStateStorage.setValue({
    isRecording: false,
    recordingId,
    mode: "display",
    tabId: null,
    uiTabId,
    startTime: null,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 7. カウントダウン表示（アクティブタブのみ） ---
  // chrome:// などコンテンツスクリプト注入できないタブではカウントダウンを
  // スキップする（display モードの主目的を阻害しないため）。
  try {
    await showCountdownAndWait(uiTabId);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "";
    if (errMsg === "Cancelled") {
      // ユーザーが Esc / キャンセルボタンで中止
      await discardDisplayCaptureStream();
      await recordingApi.abort(recordingId).catch(() => {});
      await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
      await closeOffscreenDocument();
      return;
    }
    // chrome:// ページ等で content script が動かない場合はカウントダウンをスキップ
    console.warn(
      "[Torea] display: countdown skipped (content script unavailable)",
      e,
    );
  }

  // --- 8. Offscreen Document で録画開始 ---
  try {
    await sendStartRecordingToOffscreen({
      mode: "display",
      streamId: undefined,
      recordingId,
      micEnabled,
      quality,
      effectiveLimitMs,
    });
  } catch (error) {
    await discardDisplayCaptureStream();
    await recordingApi.abort(recordingId).catch(() => {});
    await recordingStateStorage.setValue(INITIAL_RECORDING_STATE);
    await closeOffscreenDocument();
    throw error;
  }

  // --- 9. 録画開始状態を保存 ---
  const startTime = Date.now();
  await recordingStateStorage.setValue({
    isRecording: true,
    recordingId,
    mode: "display",
    tabId: null,
    uiTabId,
    startTime,
    uploadStatus: "uploading",
    errorMessage: null,
    uploadedBytes: null,
  });

  // --- 10. 録画インジケーターを表示（UI タブ＝録画開始時のアクティブタブ） ---
  browser.tabs
    .sendMessage(uiTabId, {
      type: "SHOW_RECORDING_INDICATOR",
      startTime,
    } satisfies ExtensionMessage)
    .catch(() => {
      // chrome:// など content script 不可のタブでは無視
    });
}

// =============================================
// 共通ヘルパー
// =============================================

async function queryOffscreenMimeType(): Promise<string> {
  try {
    const mimeTypeResponse = await browser.runtime.sendMessage({
      type: "QUERY_MIME_TYPE",
    } satisfies ExtensionMessage);
    return (mimeTypeResponse as { mimeType?: string })?.mimeType ?? "video/mp4";
  } catch {
    // Offscreen が応答しない場合は "video/mp4" を維持
    return "video/mp4";
  }
}

async function sendStartRecordingToOffscreen(args: {
  mode: RecordingMode;
  streamId: string | undefined;
  recordingId: string;
  micEnabled: boolean;
  quality: VideoQuality;
  effectiveLimitMs: number | undefined;
}): Promise<void> {
  let offscreenResponse: { success: boolean; error?: string } | undefined;
  try {
    offscreenResponse = await browser.runtime.sendMessage({
      type: "OFFSCREEN_START_RECORDING",
      mode: args.mode,
      streamId: args.streamId,
      recordingId: args.recordingId,
      micEnabled: args.micEnabled,
      quality: args.quality,
      effectiveLimitMs: args.effectiveLimitMs,
    } satisfies ExtensionMessage);
  } catch (e) {
    console.error("[Torea] sendStartRecordingToOffscreen failed", e);
    throw new Error(ERROR_MESSAGES.RECORDING_START_FAILED);
  }

  if (!offscreenResponse?.success) {
    console.error(
      "[Torea] offscreen returned failure",
      offscreenResponse?.error,
    );
    throw new Error(
      offscreenResponse?.error ?? ERROR_MESSAGES.RECORDING_START_FAILED,
    );
  }
}

async function discardDisplayCaptureStream(): Promise<void> {
  try {
    await browser.runtime.sendMessage({
      type: "OFFSCREEN_DISCARD_PREPARED_STREAM",
    } satisfies ExtensionMessage);
  } catch {
    // Offscreen が既に閉じている場合は無視
  }
}

/**
 * display モード用のマイク権限取得。
 *
 * tab モードと異なり、UI タブが chrome:// などの場合 content script が動かないので、
 * 通常のページが開いているタブを探してそこに iframe を注入する。
 * 見つからない場合はエラー（ユーザーに通常ページを開いてもらう必要がある）。
 */
async function ensureMicrophonePermissionForDisplay(
  uiTabId: number,
): Promise<boolean> {
  // 既に granted ならそのまま OK
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (status.state === "granted") return true;
    if (status.state === "denied") return false;
  } catch {
    // permissions.query 未対応環境ではフォールスルー
  }

  // UI タブが http(s) であればそこに注入
  const uiTab = await browser.tabs.get(uiTabId).catch(() => undefined);
  const injectableTabId = isInjectableTab(uiTab)
    ? uiTabId
    : await findInjectableTab();

  if (injectableTabId === null) {
    throw new Error(ERROR_MESSAGES.MIC_PROMPT_BLOCKED);
  }

  return ensureMicrophonePermission(injectableTabId);
}

function isInjectableTab(tab: Browser.tabs.Tab | undefined): boolean {
  if (!tab?.url) return false;
  try {
    const { protocol } = new URL(tab.url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function findInjectableTab(): Promise<number | null> {
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined && isInjectableTab(tab)) {
      return tab.id;
    }
  }
  return null;
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
      "[Torea] Content script injection failed (restricted page?)",
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

  // 録画インジケーターを非表示（UI タブ＝録画開始時のアクティブタブ）
  if (state.uiTabId) {
    browser.tabs
      .sendMessage(state.uiTabId, {
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
// プラン上限の通知（自動停止 / 残り時間警告）
// =============================================

/**
 * `chrome.notifications` で表示する短いデスクトップ通知。
 * "notifications" 権限は manifest に追加済み。
 *
 * iconUrl は MV3 では拡張機能内のリソースを `runtime.getURL` で参照する。
 * Torea の web_accessible_resources には icon があるが、popup/notifications では
 * 拡張機能のアイコン（manifest icons）が暗黙的に使われるため、未指定で問題ない。
 * Chrome の型は iconUrl を要求するので Torea の icon-128 をフォールバックに用いる。
 */
function showLimitNotification(
  id: string,
  title: string,
  message: string,
): void {
  // `chrome.notifications.create` は callback / Promise のどちらでも呼べるが
  // Promise 形は MV3 で安定しているのでこれを使う。失敗（権限拒否等）は無視する。
  try {
    browser.notifications
      .create(id, {
        type: "basic",
        title,
        message,
        iconUrl: browser.runtime.getURL("/icon/128.png"),
        priority: 2,
      })
      .catch(() => {});
  } catch {
    // notifications API 未対応などは無視
  }
}

function notifyLimitWarning(remainingMs: number): void {
  const label = remainingMs >= 60_000 ? "あと 2 分" : "あと 30 秒";
  showLimitNotification(
    `torea-limit-warning-${remainingMs}`,
    `Torea: 録画の自動停止まで${label}`,
    "Pro にすると 1 本あたり 3 時間まで録画できます。",
  );
}

function notifyLimitReached(): void {
  showLimitNotification(
    "torea-limit-reached",
    "Torea: 上限に達したため録画を停止しました",
    "Pro にすると月の総録画時間が無制限になり、1 本あたり 3 時間まで録画できます。",
  );
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

  // インジケーターを非表示（UI タブ）
  if (state?.uiTabId) {
    browser.tabs
      .sendMessage(state.uiTabId, {
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
  if (!state?.isRecording) return;

  // tab モード: 録画対象タブが閉じられたら停止
  if (state.mode === "tab" && state.tabId === closedTabId) {
    await handleStopRecording();
    return;
  }

  // display モード: UI タブが閉じられても録画自体は止めない
  // （録画対象は別ウィンドウ／画面の可能性があるため）。
  // 必要なら uiTabId をクリアしてインジケーター送信先を無効化する。
  if (state.mode === "display" && state.uiTabId === closedTabId) {
    await recordingStateStorage.setValue({ ...state, uiTabId: null });
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
    state.uploadStatus === "selecting_source" ||
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
        handleStartRecording(message.mode, message.micEnabled, message.quality)
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

      case "DISPLAY_CAPTURE_ENDED":
        // display モード時に Chrome の「共有を停止」ボタン or 共有元ウィンドウを
        // 閉じたケース。録画中なら通常の停止フローへ進める。
        recordingStateStorage.getValue().then((state) => {
          if (state?.isRecording && state.mode === "display") {
            handleStopRecording();
          }
        });
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

      case "RECORDING_LIMIT_WARNING":
        notifyLimitWarning(message.remainingMs);
        return false;

      case "RECORDING_LIMIT_REACHED":
        notifyLimitReached();
        return false;

      case "KEEPALIVE":
        // Offscreen Document からの定期ピン。受け取るだけで SW がアクティブに保たれる。
        return false;

      // --- Content Script → Background ---
      case "STOP_RECORDING_FROM_INDICATOR":
        // 録画中の UI タブからのメッセージのみ受け付ける（SEC-1）
        // 他タブのコンテンツスクリプトが録画を不正停止できないようにする
        recordingStateStorage.getValue().then((state) => {
          if (state?.isRecording && sender.tab?.id === state.uiTabId) {
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
