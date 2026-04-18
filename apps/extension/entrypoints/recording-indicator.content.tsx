import { createRoot, type Root } from "react-dom/client";
import type { ExtensionMessage } from "../types/message";
import { formatElapsed } from "../utils/format";

// =============================================
// 録画インジケーターコンポーネント
// =============================================

function RecordingIndicator({
  startTime,
  onStop,
}: {
  startTime: number;
  onStop: () => void;
}) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 16px",
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        borderRadius: "12px",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 2147483646,
        pointerEvents: "auto",
      }}
    >
      {/* 赤い録画ドット（点滅） */}
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: "#ef4444",
          animation: "torea-blink 1.5s ease-in-out infinite",
        }}
      />

      {/* 経過時間 */}
      <span
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#ffffff",
          fontVariantNumeric: "tabular-nums",
          minWidth: "48px",
        }}
      >
        {formatElapsed(elapsed)}
      </span>

      {/* 停止ボタン */}
      <button
        type="button"
        onClick={onStop}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          backgroundColor: "#ef4444",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#dc2626";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#ef4444";
        }}
        title="録画を停止"
      >
        {/* 停止アイコン（四角） */}
        <div
          style={{
            width: "12px",
            height: "12px",
            backgroundColor: "#ffffff",
            borderRadius: "2px",
          }}
        />
      </button>

      {/* 点滅アニメーション */}
      <style>
        {`
          @keyframes torea-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}
      </style>
    </div>
  );
}

// =============================================
// Content Script 定義
// =============================================

export default defineContentScript({
  matches: ["<all_urls>"],
  cssInjectionMode: "ui",

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi<Root>>> | null = null;

    function removeUi() {
      ui?.remove();
      ui = null;
    }

    async function showIndicator(startTime: number) {
      removeUi();

      const created = await createShadowRootUi(ctx, {
        name: "torea-recording-indicator",
        position: "overlay",
        zIndex: 2147483646,
        // ページのキーボード/ポインターイベントが録画インジケーターに干渉しないよう分離する
        isolateEvents: true,
        onMount(container) {
          // オーバーレイ自体はクリックを透過させる
          container.style.pointerEvents = "none";

          const wrapper = document.createElement("div");
          container.append(wrapper);
          const root = createRoot(wrapper);
          root.render(
            <RecordingIndicator
              startTime={startTime}
              onStop={() => {
                browser.runtime.sendMessage({
                  type: "STOP_RECORDING_FROM_INDICATOR",
                } satisfies ExtensionMessage);
              }}
            />,
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });

      ui = created;
      ui.mount();
    }

    // --- メッセージリスナー ---
    browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === "SHOW_RECORDING_INDICATOR") {
        showIndicator(message.startTime);
      } else if (message.type === "HIDE_RECORDING_INDICATOR") {
        removeUi();
      }
    });

    // --- ページ読み込み時: 録画中なら自動表示 ---
    try {
      const state = await browser.runtime.sendMessage({
        type: "QUERY_RECORDING_STATE",
      } satisfies ExtensionMessage);

      if (state?.isRecording && state.startTime) {
        showIndicator(state.startTime);
      }
    } catch {
      // Background が応答しない場合は無視
    }
  },
});
