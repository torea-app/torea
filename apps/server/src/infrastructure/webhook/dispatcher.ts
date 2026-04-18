/**
 * Webhook HTTP 配信クライアント。
 *
 * セキュリティ方針:
 *  - HMAC-SHA256 署名をヘッダに付与（Standard Webhooks 互換）
 *  - 10 秒 AbortController タイムアウト
 *  - `redirect: "manual"` でリダイレクト追跡を禁止（private IP への rebinding 防止）
 *    3xx ステータスは追跡せず失敗扱いする。Cloudflare Workers は `redirect: "error"` を
 *    実装していないため "manual" + ステータス判定で代替する。
 *  - レスポンスは先頭 2KB のみ保存
 */

import { hmacSha256Hex } from "./crypto";

export type DispatchInput = {
  url: string;
  secret: string;
  deliveryId: string;
  eventId: string;
  eventName: string;
  eventVersion: "v1";
  /** JSON 文字列化済み envelope */
  body: string;
};

export type DispatchResult = {
  ok: boolean;
  status: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
};

const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2048;

export async function dispatchWebhook(
  input: DispatchInput,
): Promise<DispatchResult> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacSha256Hex(
    input.secret,
    `${timestamp}.${input.body}`,
  );
  const started = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(input.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Torea-Webhook/1.0",
        "X-Webhook-Id": input.deliveryId,
        "X-Webhook-Event": input.eventName,
        "X-Webhook-Event-Id": input.eventId,
        "X-Webhook-Version": input.eventVersion,
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Signature": `v1=${signature}`,
      },
      body: input.body,
      redirect: "manual",
    });
    const text = await res.text();
    // 3xx は追跡せず失敗扱い (SSRF 対策として private IP への rebinding を防止)
    const isRedirect = res.status >= 300 && res.status < 400;
    const ok = res.ok && !isRedirect;
    return {
      ok,
      status: res.status,
      responseBody: text.slice(0, MAX_RESPONSE_BYTES),
      errorMessage: ok
        ? null
        : isRedirect
          ? `HTTP ${res.status} (redirect not allowed)`
          : `HTTP ${res.status}`,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      status: null,
      responseBody: null,
      errorMessage: msg,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
