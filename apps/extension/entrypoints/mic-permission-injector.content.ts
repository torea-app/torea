import type { ExtensionMessage } from "../types/message";

/**
 * マイク権限取得用 iframe をタブに注入する Content Script。
 *
 * Background からの INJECT_MIC_PERMISSION_IFRAME メッセージを受け取り、
 * 現在のタブの visible context に chrome-extension:// の iframe を注入する。
 * iframe 内で getUserMedia が呼ばれ、Chrome のパーミッションダイアログが表示される。
 * 結果を Background に返す。
 */

const IFRAME_ID = "screenbase-mic-permission-iframe";
const PERMISSION_TIMEOUT_MS = 30_000;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  world: "ISOLATED",

  main() {
    browser.runtime.onMessage.addListener(
      (message: ExtensionMessage, _sender, sendResponse) => {
        if (message.type === "INJECT_MIC_PERMISSION_IFRAME") {
          injectPermissionIframe(message.nonce)
            .then((granted) => sendResponse({ granted }))
            .catch(() => sendResponse({ granted: false }));
          return true; // 非同期レスポンス
        }
        return false;
      },
    );
  },
});

function cleanupIframe(): void {
  document.getElementById(IFRAME_ID)?.remove();
}

function createHiddenIframe(nonce: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.id = IFRAME_ID;
  const iframeUrl = new URL(browser.runtime.getURL("/mic-permission.html"));
  // ノンスを URL パラメータとして渡す。iframe 側がこの値とメッセージのノンスを照合することで
  // 任意のウェブページが REQUEST_MIC_PERMISSION を偽装できないようにする。
  iframeUrl.searchParams.set("nonce", nonce);
  iframe.src = iframeUrl.toString();
  // allow="microphone *" がないとブラウザが iframe 内の getUserMedia をブロックする
  iframe.setAttribute("allow", "microphone *");
  iframe.style.cssText =
    "position:fixed !important;top:-9999px !important;left:-9999px !important;width:1px !important;height:1px !important;opacity:0 !important;pointer-events:none !important;border:none !important;";
  return iframe;
}

async function injectPermissionIframe(nonce: string): Promise<boolean> {
  return new Promise((resolve) => {
    cleanupIframe();
    const iframe = createHiddenIframe(nonce);

    let timeout: ReturnType<typeof setTimeout>;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: string; granted?: boolean };
      if (data.type === "MIC_PERMISSION_RESULT") {
        clearTimeout(timeout);
        window.removeEventListener("message", handleMessage);
        cleanupIframe();
        resolve(data.granted ?? false);
      }
    };

    timeout = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      cleanupIframe();
      resolve(false);
    }, PERMISSION_TIMEOUT_MS);

    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);

    iframe.onload = () => {
      // targetOrigin を拡張機能のオリジンに限定し、
      // 他のオリジンが REQUEST_MIC_PERMISSION を傍受できないようにする。
      // nonce を含めることで iframe 側がリクエストの正当性を検証できる。
      const extensionOrigin = new URL(browser.runtime.getURL("/")).origin;
      iframe.contentWindow?.postMessage(
        { type: "REQUEST_MIC_PERMISSION", nonce },
        extensionOrigin,
      );
    };

    iframe.onerror = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handleMessage);
      cleanupIframe();
      resolve(false);
    };
  });
}
