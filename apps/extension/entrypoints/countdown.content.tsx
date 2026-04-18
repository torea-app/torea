import { createRoot, type Root } from "react-dom/client";
import { COUNTDOWN_SECONDS } from "../lib/constants";
import type { ExtensionMessage } from "../types/message";

// =============================================
// カウントダウンコンポーネント
// =============================================

function CountdownOverlay({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [count, setCount] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  // Esc キーでキャンセル
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 2147483647,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* カウントダウン数字 */}
      <div
        style={{
          fontSize: "160px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1,
          textShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          animation: "torea-pulse 1s ease-in-out infinite",
        }}
      >
        {count}
      </div>

      {/* 説明テキスト */}
      <p
        style={{
          marginTop: "24px",
          fontSize: "16px",
          color: "rgba(255, 255, 255, 0.8)",
        }}
      >
        録画を開始します...
      </p>

      {/* キャンセルボタン */}
      <button
        type="button"
        onClick={onCancel}
        style={{
          marginTop: "32px",
          padding: "8px 24px",
          fontSize: "14px",
          color: "rgba(255, 255, 255, 0.9)",
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "8px",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)";
        }}
      >
        キャンセル (Esc)
      </button>

      {/* パルスアニメーション */}
      <style>
        {`
          @keyframes torea-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
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

    browser.runtime.onMessage.addListener((message: ExtensionMessage) => {
      if (message.type === "SHOW_COUNTDOWN") {
        // 既存のカウントダウンがあれば削除
        removeUi();

        createShadowRootUi(ctx, {
          name: "torea-countdown",
          position: "overlay",
          zIndex: 2147483647,
          isolateEvents: true,
          onMount(container) {
            const wrapper = document.createElement("div");
            container.append(wrapper);
            const root = createRoot(wrapper);
            root.render(
              <CountdownOverlay
                onComplete={() => {
                  removeUi();
                  browser.runtime
                    .sendMessage({
                      type: "COUNTDOWN_COMPLETED",
                    } satisfies ExtensionMessage)
                    .catch(() => {
                      // SW 再起動直後など応答がない場合は無視
                    });
                }}
                onCancel={() => {
                  removeUi();
                  browser.runtime
                    .sendMessage({
                      type: "COUNTDOWN_CANCELLED",
                    } satisfies ExtensionMessage)
                    .catch(() => {});
                }}
              />,
            );
            return root;
          },
          onRemove(root) {
            root?.unmount();
          },
        }).then((created) => {
          ui = created;
          ui.mount();
        });
      }
    });
  },
});
