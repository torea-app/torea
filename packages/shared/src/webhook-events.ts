/**
 * Webhook イベントカタログ（UI 表示用）。
 *
 * サーバー側の真の enum は `apps/server/src/domain/types/webhook.ts` の
 * `WEBHOOK_EVENT_NAMES` に定義されているが、web 側から server のドメイン型を
 * 直接 import するとレイヤー越境になるため、UI 用のラベルを含むカタログを
 * ここで独立定義する。名前が同期しているかは server 側テスト／lint で検証する。
 */

export const WEBHOOK_EVENT_CATALOG = [
  {
    name: "recording.created",
    label: "録画開始",
    category: "recording",
  },
  {
    name: "recording.completed",
    label: "録画処理完了",
    category: "recording",
  },
  {
    name: "recording.failed",
    label: "録画処理失敗",
    category: "recording",
  },
  {
    name: "recording.deleted",
    label: "録画削除",
    category: "recording",
  },
  {
    name: "transcription.started",
    label: "文字起こし開始",
    category: "transcription",
  },
  {
    name: "transcription.completed",
    label: "文字起こし完了",
    category: "transcription",
  },
  {
    name: "transcription.failed",
    label: "文字起こし失敗",
    category: "transcription",
  },
] as const;

export type WebhookEventCatalogEntry = (typeof WEBHOOK_EVENT_CATALOG)[number];
export type WebhookEventCategory = WebhookEventCatalogEntry["category"];
