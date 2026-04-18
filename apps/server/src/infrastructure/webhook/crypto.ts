/**
 * Web Crypto ベースの HMAC / SHA-256 / secret 生成ユーティリティ。
 * Workers native のみ使用し、追加依存なし。
 *
 * Standard Webhooks 仕様: signature = hex(HMAC-SHA256(secret, `${timestamp}.${body}`))
 */

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(sig);
}

export async function sha256Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return toHex(buf);
}

/**
 * `whsec_` プレフィックス付きの 32 バイトランダムシークレットを生成する。
 * 出力例: `whsec_3f2a...` (66 文字)
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `whsec_${hex}`;
}
