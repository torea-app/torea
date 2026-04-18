/**
 * Webhook 送信先 URL の SSRF / 危険 URL バリデーション。
 *
 * 拒否条件:
 *  - HTTPS 以外
 *  - 認証情報を含む (user:pass@)
 *  - localhost / クラウドメタデータホスト
 *  - IPv4 プライベート/予約済み (127.x / 10.x / 172.16-31.x / 192.168.x / 169.254.x / 0.x / 224.x+)
 *  - IPv6 loopback / link-local / unique-local (::1 / fe80:: / fc00::/7)
 */

const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
]);

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export function validateWebhookUrl(raw: string): UrlValidationResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL の形式が不正です" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "HTTPS でのみ送信できます" };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "URL に認証情報（user:pass@）を含めることはできません",
    };
  }

  const host = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTS.has(host)) {
    return { ok: false, reason: "内部ホストは指定できません" };
  }

  // IPv4 リテラル
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast / reserved
    ) {
      return {
        ok: false,
        reason: "プライベート/予約済み IP アドレスは指定できません",
      };
    }
    return { ok: true, url };
  }

  // IPv6 リテラル ([::1] / [fe80::...])
  if (host.startsWith("[") && host.endsWith("]")) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    ) {
      return {
        ok: false,
        reason: "ローカル IPv6 アドレスは指定できません",
      };
    }
  }

  return { ok: true, url };
}
