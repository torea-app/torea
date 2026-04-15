/**
 * マイク権限取得用 iframe ドキュメント
 *
 * 現在のタブの visible context に iframe として注入され、
 * getUserMedia を呼び出してマイク権限ダイアログを表示する。
 * 結果は postMessage で親ウィンドウ（Content Script）に通知する。
 *
 * セキュリティ（多層防御）:
 * 1. URL パラメータの nonce とメッセージの nonce を照合する（第一層）
 * 2. Background サービスワーカーに nonce を送信して検証する（第二層）
 *    Background が発行した nonce のみが有効。一度使うと無効化（使い捨て）。
 *    → 攻撃者が mic-permission.html を直接 iframe 埋め込みして任意の nonce を
 *      作成しても、Background の nonce 台帳に登録されていないため拒否される。
 * 3. targetOrigin を要求元オリジンに限定し、応答の漏洩を防ぐ（第三層）
 */

async function checkPermissionState(): Promise<PermissionState> {
  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return result.state;
  } catch {
    return "prompt";
  }
}

async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Background サービスワーカーに nonce の検証を依頼する（第二層のセキュリティチェック）。
 * Background が発行・記録した nonce と一致する場合のみ true を返す。
 * 一致したノンスは即座に削除されるため、再利用できない。
 */
async function validateNonceWithBackground(nonce: string): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "VALIDATE_MIC_NONCE",
      nonce,
    });
    return (response as { valid?: boolean } | null)?.valid === true;
  } catch {
    // Background が応答しない場合は安全側に倒して拒否
    return false;
  }
}

/**
 * @param nonce - 検証済みノンス（Background でも検証する）
 * @param callerOrigin - 要求元のオリジン（postMessage の targetOrigin として使用）
 */
async function handlePermissionRequest(
  nonce: string,
  callerOrigin: string,
): Promise<void> {
  // Background でノンスを検証（第二層）
  // Background が発行した正規のノンスでない場合は処理しない
  const isValidNonce = await validateNonceWithBackground(nonce);
  if (!isValidNonce) {
    window.parent.postMessage(
      { type: "MIC_PERMISSION_RESULT", granted: false },
      callerOrigin,
    );
    return;
  }

  const state = await checkPermissionState();

  if (state === "granted") {
    window.parent.postMessage(
      { type: "MIC_PERMISSION_RESULT", granted: true },
      callerOrigin,
    );
    return;
  }

  if (state === "denied") {
    window.parent.postMessage(
      { type: "MIC_PERMISSION_RESULT", granted: false },
      callerOrigin,
    );
    return;
  }

  // "prompt" 状態 → getUserMedia でダイアログを表示
  const granted = await requestMicrophone();
  window.parent.postMessage(
    { type: "MIC_PERMISSION_RESULT", granted },
    callerOrigin,
  );
}

// URL パラメータからノンスを取得する（第一層）。
// ノンスが存在しない場合はこの iframe が正規フローで起動されていないため、
// 以降のメッセージを一切受け付けない。
const expectedNonce = new URLSearchParams(location.search).get("nonce");

window.addEventListener("message", (event) => {
  // null オリジンからの不審なメッセージは無視する
  if (!event.origin || event.origin === "null") return;

  const data = event.data as { type?: string; nonce?: string };

  if (data.type === "REQUEST_MIC_PERMISSION") {
    // URL パラメータのノンスとメッセージのノンスが一致しない場合は処理しない（第一層）
    if (!expectedNonce || data.nonce !== expectedNonce) return;

    // event.origin を targetOrigin として使うことで、
    // 応答が要求元のオリジン以外に届かないようにする（第三層）
    handlePermissionRequest(data.nonce, event.origin);
  }
});
