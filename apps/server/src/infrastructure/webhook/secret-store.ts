/**
 * Webhook secret を KV namespace に保存する薄いラッパ。
 *
 * 設計方針:
 *  - 平文 secret は D1 に一切保存しない（DB 漏洩時の被害範囲を最小化）
 *  - KV に `endpoint:<id>` キーで永続化し、配信時のみ読み出す
 *  - endpoint 削除時に同キーを削除
 */

function keyFor(endpointId: string): string {
  return `endpoint:${endpointId}`;
}

export function createWebhookSecretStore(kv: KVNamespace) {
  return {
    async put(endpointId: string, secret: string): Promise<void> {
      await kv.put(keyFor(endpointId), secret);
    },

    async get(endpointId: string): Promise<string | null> {
      return kv.get(keyFor(endpointId));
    },

    async delete(endpointId: string): Promise<void> {
      await kv.delete(keyFor(endpointId));
    },
  };
}

export type WebhookSecretStore = ReturnType<typeof createWebhookSecretStore>;
