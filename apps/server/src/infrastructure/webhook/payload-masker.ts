/**
 * 受信側へ配信する payload 内に含まれる機密値を再帰的にマスクする。
 * 配信失敗時の履歴 (`webhook_delivery.payload`) にも同じ形で保存されるため、
 * たとえ DB が漏洩しても機密値が流出しないようにする。
 */

const MASK_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "sessionid",
  "session_id",
  "cookie",
  "set-cookie",
]);

const MASK = "****";

export function maskSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = MASK_KEYS.has(k.toLowerCase()) ? MASK : maskSensitive(v);
    }
    return out;
  }
  return value;
}
