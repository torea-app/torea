import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "../../lib/auth-client";
import {
  QUALITY_PRESET_ORDER,
  QUALITY_PRESETS,
  WEB_URL,
} from "../../lib/constants";
import { fetchPlanGuard, type PlanGuardData } from "../../lib/plan-guard";
import {
  audioSettingsStorage,
  modeSettingsStorage,
  qualitySettingsStorage,
  recordingStateStorage,
} from "../../lib/storage";
import type { ExtensionMessage } from "../../types/message";
import {
  type AudioSettings,
  INITIAL_RECORDING_STATE,
  type ModeSettings,
  type QualitySettings,
  type RecordingMode,
  type RecordingState,
  type VideoQuality,
} from "../../types/recording";
import { formatElapsed } from "../../utils/format";

// =============================================
// ユーティリティ: 録画可能な URL かどうかを判定
// =============================================

/**
 * タブの URL が録画可能かどうかを返す。
 * chrome://, chrome-extension://, edge://, about:, data:, javascript: は
 * tabCapture API がキャプチャできないため false を返す。
 */
function isRecordableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return ![
      "chrome:",
      "chrome-extension:",
      "edge:",
      "moz-extension:",
      "about:",
      "data:",
      "javascript:",
    ].includes(protocol);
  } catch {
    return false;
  }
}

// =============================================
// shadcn コンポーネント
// =============================================

import { Button } from "@torea/ui/components/ui/button";
import { Label } from "@torea/ui/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@torea/ui/components/ui/radio-group";
import { Separator } from "@torea/ui/components/ui/separator";
import { Switch } from "@torea/ui/components/ui/switch";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  AppWindowIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  Loader2Icon,
  LogOutIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  SquareIcon,
} from "lucide-react";

// =============================================
// カスタムフック: 録画状態の監視
// =============================================

function useRecordingState(): RecordingState {
  const [state, setState] = useState<RecordingState>(INITIAL_RECORDING_STATE);

  useEffect(() => {
    // 初期値を取得（エラーは無視してデフォルト値のまま表示）
    recordingStateStorage
      .getValue()
      .then((value) => {
        if (value) setState(value);
      })
      .catch(console.error);

    // 変更を監視
    const unwatch = recordingStateStorage.watch((newValue) => {
      if (newValue) setState(newValue);
    });

    return unwatch;
  }, []);

  return state;
}

// =============================================
// カスタムフック: オーディオ設定
// =============================================

function useAudioSettings(): [
  AudioSettings,
  (settings: AudioSettings) => void,
] {
  const [settings, setSettings] = useState<AudioSettings>({ micEnabled: true });

  useEffect(() => {
    audioSettingsStorage.getValue().then((value) => {
      if (value) setSettings(value);
    });
  }, []);

  function updateSettings(newSettings: AudioSettings) {
    setSettings(newSettings);
    audioSettingsStorage.setValue(newSettings).catch(console.error);
  }

  return [settings, updateSettings];
}

// =============================================
// カスタムフック: 品質設定
// =============================================

function useQualitySettings(): [
  QualitySettings,
  (settings: QualitySettings) => void,
] {
  const [settings, setSettings] = useState<QualitySettings>({
    quality: "high",
  });

  useEffect(() => {
    qualitySettingsStorage.getValue().then((value) => {
      if (value) setSettings(value);
    });
  }, []);

  function updateSettings(newSettings: QualitySettings) {
    setSettings(newSettings);
    qualitySettingsStorage.setValue(newSettings).catch(console.error);
  }

  return [settings, updateSettings];
}

// =============================================
// カスタムフック: 録画モード設定
// =============================================

function useModeSettings(): [ModeSettings, (settings: ModeSettings) => void] {
  const [settings, setSettings] = useState<ModeSettings>({ mode: "tab" });

  useEffect(() => {
    modeSettingsStorage.getValue().then((value) => {
      if (value) setSettings(value);
    });
  }, []);

  function updateSettings(newSettings: ModeSettings) {
    setSettings(newSettings);
    modeSettingsStorage.setValue(newSettings).catch(console.error);
  }

  return [settings, updateSettings];
}

// =============================================
// カスタムフック: プラン情報（録画ガード用）
// =============================================

/**
 * `GET /api/billing/me` を 1 度叩いて、プラン上限と月の残量を取得する。
 * 認証エラーや fetch 失敗時は `null` のまま（ガードは API 側でも再判定するため、
 * popup 側の判定は UX のためのものに留まる）。
 */
function usePlanGuard(enabled: boolean): PlanGuardData | null {
  const [data, setData] = useState<PlanGuardData | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchPlanGuard().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return data;
}

// =============================================
// LoginView — 未認証
// =============================================

function LoginView() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-bold text-base">Torea</h1>
        <p className="mt-1 text-muted-foreground text-xs">
          ログインして利用を開始してください。
        </p>
      </div>
      <Button
        className="w-full"
        onClick={() => browser.tabs.create({ url: `${WEB_URL}/sign-in` })}
      >
        ログイン
      </Button>
    </div>
  );
}

// =============================================
// IdleView — 待機中（録画開始可能）
// =============================================

function IdleView({
  audioSettings,
  onUpdateAudioSettings,
  qualitySettings,
  onUpdateQualitySettings,
  modeSettings,
  onUpdateModeSettings,
  onStartRecording,
  planGuard,
}: {
  audioSettings: AudioSettings;
  onUpdateAudioSettings: (settings: AudioSettings) => void;
  qualitySettings: QualitySettings;
  onUpdateQualitySettings: (settings: QualitySettings) => void;
  modeSettings: ModeSettings;
  onUpdateModeSettings: (settings: ModeSettings) => void;
  onStartRecording: () => void;
  planGuard: PlanGuardData | null;
}) {
  const [tabTitle, setTabTitle] = useState<string | null>(null);
  const [tabUrl, setTabUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabTitle(tabs[0]?.title ?? null);
      setTabUrl(tabs[0]?.url ?? null);
    });
  }, []);

  const isTabMode = modeSettings.mode === "tab";
  const isTabRecordable = isRecordableUrl(tabUrl);
  // undefined = まだ取得中
  const isLoadingTab = tabUrl === undefined;

  // プランガード: 月の総録画時間を使い切ったら録画開始を不可にする
  const monthlyExhausted =
    planGuard !== null && planGuard.monthlyRecordingDurationRemainingMs === 0;
  const selectedQualityLocked =
    planGuard !== null &&
    !planGuard.availableQualities.includes(qualitySettings.quality);

  // 選択中の画質が現プランで使えない（例: 解約後に保存値が ultra のまま）場合は
  // 自動で利用可能な上位画質にフォールバックする（UX 改善 + 開始ボタン有効化）。
  useEffect(() => {
    if (!selectedQualityLocked || planGuard === null) return;
    const fallback =
      QUALITY_PRESET_ORDER.find((q) =>
        planGuard.availableQualities.includes(q),
      ) ?? "medium";
    onUpdateQualitySettings({ quality: fallback });
  }, [selectedQualityLocked, planGuard, onUpdateQualitySettings]);

  // tab モードは「録画可能 URL」が必要、display モードは常に開始可能
  const canStart = isTabMode
    ? !isLoadingTab && isTabRecordable && !monthlyExhausted
    : !monthlyExhausted;

  return (
    <div className="space-y-4">
      {/* 録画モード選択 */}
      <div className="space-y-2">
        <Label className="font-medium text-muted-foreground text-xs">
          録画対象
        </Label>
        <RadioGroup
          value={modeSettings.mode}
          onValueChange={(val) =>
            onUpdateModeSettings({ mode: val as RecordingMode })
          }
          className="gap-1.5"
        >
          <div>
            <label
              htmlFor="mode-tab"
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                isTabMode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem id="mode-tab" value="tab" />
              <MonitorIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 items-baseline justify-between gap-2">
                <span className="font-medium text-sm">現在のタブ</span>
                <span className="text-muted-foreground text-xs">
                  クリックしたタブのみ
                </span>
              </div>
            </label>
          </div>
          <div>
            <label
              htmlFor="mode-display"
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                !isTabMode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem id="mode-display" value="display" />
              <AppWindowIcon className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 items-baseline justify-between gap-2">
                <span className="font-medium text-sm">画面・ウィンドウ</span>
                <span className="text-muted-foreground text-xs">
                  開始時に共有先を選択
                </span>
              </div>
            </label>
          </div>
        </RadioGroup>

        {/* display モード時の音声共有ヒント */}
        {!isTabMode && (
          <p className="px-1 text-muted-foreground text-xs leading-relaxed">
            音声を含めるには Chrome
            のピッカーで「音声を共有」にチェックを入れてください。ウィンドウ単体の音声共有は
            Chrome 141 以降（macOS は 14.2 以降）で対応しています。
          </p>
        )}
      </div>

      {/* tab モード時のみ現在のタブ情報を表示 */}
      {isTabMode && (
        <div className="flex items-start gap-2 rounded-md border p-3">
          <MonitorIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 text-sm">
            {tabTitle ?? "タブ情報を取得中..."}
          </p>
        </div>
      )}

      {/* 録画不可タブの警告（tab モード のみ）（EDGE-1） */}
      {isTabMode && !isLoadingTab && !isTabRecordable && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <p className="text-xs">
            このページは録画できません。別のタブに切り替えるか「画面・ウィンドウ」モードを選択してください。
          </p>
        </div>
      )}

      {/* 月の総録画時間 上限到達 */}
      {monthlyExhausted && (
        <div className="flex flex-col gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <div className="flex items-start gap-1.5">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
            <p className="text-xs">
              今月の録画時間の上限に達しました。Pro にすると無制限になります。
            </p>
          </div>
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() =>
              browser.tabs.create({
                url: `${WEB_URL}/pricing?source=quota_exceeded`,
              })
            }
          >
            Pro へアップグレード
          </Button>
        </div>
      )}

      {/* 品質設定 */}
      <div className="space-y-2">
        <Label className="font-medium text-muted-foreground text-xs">
          録画品質
        </Label>
        <RadioGroup
          value={qualitySettings.quality}
          onValueChange={(val) =>
            onUpdateQualitySettings({ quality: val as VideoQuality })
          }
          className="gap-1.5"
        >
          {QUALITY_PRESET_ORDER.map((quality) => {
            const preset = QUALITY_PRESETS[quality];
            const isSelected = qualitySettings.quality === quality;
            const isLocked =
              planGuard !== null &&
              !planGuard.availableQualities.includes(quality);

            // ロックされたプリセットは radio ではなく <button> に差し替えて、
            // クリック / Enter / Space で /pricing を開けるようにする
            // （disabled な radio はキーボードフォーカスできないため、
            //  label の onClick で代用すると a11y 的に NG になる）。
            if (isLocked) {
              return (
                <button
                  key={quality}
                  type="button"
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-left opacity-60 transition-opacity hover:opacity-80"
                  onClick={() =>
                    browser.tabs.create({
                      url: `${WEB_URL}/pricing?source=quality_locked_ultra`,
                    })
                  }
                >
                  <RadioGroupItem value={quality} disabled />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium text-sm">
                      {preset.label}
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Pro
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {preset.description}
                    </span>
                  </div>
                </button>
              );
            }

            return (
              <div key={quality}>
                <label
                  htmlFor={`quality-${quality}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem id={`quality-${quality}`} value={quality} />
                  <div className="flex flex-1 items-baseline justify-between gap-2">
                    <span className="font-medium text-sm">{preset.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {preset.description}
                    </span>
                  </div>
                </label>
                {/* Ultra 選択時の注意メッセージ（Pro ユーザーのみ） */}
                {quality === "ultra" && isSelected && (
                  <div className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                    <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
                    <p className="text-xs">
                      長時間録画では大量のデータを消費します
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* マイク設定 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {audioSettings.micEnabled ? (
            <MicIcon className="size-4 text-foreground" />
          ) : (
            <MicOffIcon className="size-4 text-muted-foreground" />
          )}
          <Label htmlFor="mic-toggle" className="text-sm">
            マイク
          </Label>
        </div>
        <Switch
          id="mic-toggle"
          checked={audioSettings.micEnabled}
          onCheckedChange={(checked) =>
            onUpdateAudioSettings({ micEnabled: checked })
          }
        />
      </div>

      <Separator />

      {/* 録画開始ボタン（tab モードで録画不可ページの場合のみ disabled） */}
      <Button
        className="w-full"
        onClick={onStartRecording}
        disabled={!canStart}
      >
        録画を開始
      </Button>
    </div>
  );
}

// =============================================
// RecordingView — 録画中
// =============================================

function RecordingView({
  startTime,
  onStopRecording,
}: {
  startTime: number;
  onStopRecording: () => void;
}) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="space-y-4">
      {/* 録画中インジケーター */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="size-3 animate-pulse rounded-full bg-destructive" />
          <span className="font-medium text-destructive text-sm">録画中</span>
        </div>
        <span className="font-mono text-2xl tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>

      <Separator />

      {/* 録画停止ボタン */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={onStopRecording}
      >
        <SquareIcon className="mr-2 size-4" />
        録画を停止
      </Button>
    </div>
  );
}

// =============================================
// ProcessingView — 処理中
// =============================================

function ProcessingView({
  message = "録画を処理中...",
  detail,
}: {
  message?: string;
  /** サブテキスト（アップロード進捗など） */
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground text-sm">{message}</p>
      {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
    </div>
  );
}

// =============================================
// CompletedView — 完了（フォールバック用）
// 通常は handleVideoReady で新タブが開き即座に idle に戻るため、
// このビューが表示されるのは一瞬のみ。
// =============================================

function CompletedView({ onReset }: { onReset: () => void }) {
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    // 即座にリセット（新タブが既に開かれている）
    const timer = setTimeout(() => onResetRef.current(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <CheckCircleIcon className="size-8 text-primary" />
      <p className="font-medium text-sm">録画が完了しました</p>
    </div>
  );
}

// =============================================
// ErrorView — エラー
// =============================================

function ErrorView({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-destructive text-sm">{message}</p>
      </div>
      <Button variant="outline" className="w-full" onClick={onDismiss}>
        閉じる
      </Button>
    </div>
  );
}

// =============================================
// App — ルートコンポーネント
// =============================================

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const recordingState = useRecordingState();
  const [audioSettings, updateAudioSettings] = useAudioSettings();
  const [qualitySettings, updateQualitySettings] = useQualitySettings();
  const [modeSettings, updateModeSettings] = useModeSettings();
  const [isStarting, setIsStarting] = useState(false);
  const planGuard = usePlanGuard(!!session);

  // --- 録画開始 ---
  const handleStartRecording = useCallback(async () => {
    setIsStarting(true);
    try {
      const response = await browser.runtime.sendMessage({
        type: "START_RECORDING",
        mode: modeSettings.mode,
        micEnabled: audioSettings.micEnabled,
        quality: qualitySettings.quality,
      } satisfies ExtensionMessage);

      if (response && !response.success) {
        // エラーは recordingStateStorage 経由で反映される
        console.error("Recording start failed:", response.error);
      }
    } catch (error) {
      console.error("Failed to send start message:", error);
    } finally {
      setIsStarting(false);
    }
  }, [modeSettings.mode, audioSettings.micEnabled, qualitySettings.quality]);

  // --- 録画停止 ---
  const handleStopRecording = useCallback(async () => {
    try {
      await browser.runtime.sendMessage({
        type: "STOP_RECORDING",
      } satisfies ExtensionMessage);
    } catch (error) {
      console.error("Failed to send stop message:", error);
    }
  }, []);

  // --- 状態リセット ---
  const handleReset = useCallback(() => {
    recordingStateStorage
      .setValue(INITIAL_RECORDING_STATE)
      .catch(console.error);
  }, []);

  // --- ログアウト ---
  const handleLogout = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("[Torea] logout failed:", error);
    }
  }, []);

  // --- ローディング ---
  if (isPending) {
    return (
      <div className="flex w-80 items-center justify-center bg-background p-6 text-foreground">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- 未認証 ---
  if (!session) {
    return (
      <div className="w-80 bg-background p-4 text-foreground">
        <LoginView />
      </div>
    );
  }

  // 録画中・アップロード中はログアウトを無効にする（EDGE-2）
  const isRecordingActive =
    recordingState.isRecording ||
    recordingState.uploadStatus === "uploading" ||
    recordingState.uploadStatus === "completing";

  // completing フェーズのアップロード進捗表示テキスト（UX-4）
  const completingDetail =
    recordingState.uploadedBytes != null
      ? `${(recordingState.uploadedBytes / (1024 * 1024)).toFixed(1)} MB 転送済み`
      : undefined;

  // --- 認証済み ---
  return (
    <div className="w-80 bg-background p-4 text-foreground">
      {/* ヘッダー */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-bold text-base">Torea</h1>
        <div className="flex items-center gap-1">
          {/* ダッシュボードリンク（UX-2） */}
          <Button
            variant="ghost"
            size="xs"
            title="録画一覧を開く"
            onClick={() =>
              browser.tabs.create({ url: `${WEB_URL}/dashboard/recordings` })
            }
          >
            <ExternalLinkIcon className="size-3" />
          </Button>
          {/* ログアウト（録画中は無効） */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleLogout}
            disabled={isRecordingActive}
            title={
              isRecordingActive ? "録画中はログアウトできません" : undefined
            }
          >
            <LogOutIcon className="mr-1 size-3" />
            ログアウト
          </Button>
        </div>
      </div>

      {/* 状態に応じたビュー */}
      {recordingState.uploadStatus === "error" &&
      recordingState.errorMessage ? (
        <ErrorView
          message={recordingState.errorMessage}
          onDismiss={handleReset}
        />
      ) : recordingState.uploadStatus === "completed" ? (
        <CompletedView onReset={handleReset} />
      ) : recordingState.uploadStatus === "completing" ? (
        <ProcessingView message="アップロード中..." detail={completingDetail} />
      ) : recordingState.uploadStatus === "requesting_mic" ? (
        <ProcessingView message="マイクへのアクセスを許可してください..." />
      ) : recordingState.uploadStatus === "selecting_source" ? (
        <ProcessingView message="共有する画面・ウィンドウを選択してください..." />
      ) : recordingState.isRecording && recordingState.startTime ? (
        <RecordingView
          startTime={recordingState.startTime}
          onStopRecording={handleStopRecording}
        />
      ) : isStarting ? (
        <ProcessingView />
      ) : (
        <IdleView
          audioSettings={audioSettings}
          onUpdateAudioSettings={updateAudioSettings}
          qualitySettings={qualitySettings}
          onUpdateQualitySettings={updateQualitySettings}
          modeSettings={modeSettings}
          onUpdateModeSettings={updateModeSettings}
          onStartRecording={handleStartRecording}
          planGuard={planGuard}
        />
      )}
    </div>
  );
}
