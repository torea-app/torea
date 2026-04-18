import type { WebhookEventName } from "../../domain/types/webhook";
import type { WebhookEventEnvelope } from "../../domain/types/webhook-events";
import type { createWebhookRepository } from "../../infrastructure/repositories/webhook.repository";
import type { maskSensitive as maskSensitiveFn } from "../../infrastructure/webhook/payload-masker";

type Repo = ReturnType<typeof createWebhookRepository>;
type DeliveryQueue = Queue<{ deliveryId: string; organizationId: string }>;

type Deps = {
  repo: Repo;
  queue: DeliveryQueue;
  generateId: () => string;
  mask: typeof maskSensitiveFn;
  now: () => Date;
};

/**
 * ビジネスイベントを受けて、該当組織の active endpoint 全てに対して
 * `webhook_delivery` 行を pending 状態で作成し、Queue に投入する emitter。
 */
export function createWebhookEmitter(deps: Deps) {
  return {
    async emit<N extends WebhookEventName>(
      envelope: WebhookEventEnvelope<N>,
    ): Promise<void> {
      const endpoints = await deps.repo.findActiveEndpointsForEvent(
        envelope.organizationId,
        envelope.name,
      );
      if (endpoints.length === 0) return;

      const now = deps.now();
      const maskedPayload = deps.mask(envelope);

      for (const ep of endpoints) {
        const deliveryId = deps.generateId();
        try {
          await deps.repo.createDelivery({
            id: deliveryId,
            endpointId: ep.id,
            organizationId: envelope.organizationId,
            eventName: envelope.name,
            eventVersion: envelope.version,
            eventId: envelope.id,
            payload: maskedPayload,
            status: "pending",
            attemptCount: 0,
            maxAttempts: 6,
            nextAttemptAt: now,
          });
        } catch (err) {
          // unique (endpointId, eventId) 制約違反は「既に同一イベント配信済み」の冪等性保証。
          // D1 ではエラー文字列で判別する。
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("UNIQUE") ||
            msg.includes("constraint failed") ||
            msg.includes("2067") // SQLite extended error code SQLITE_CONSTRAINT_UNIQUE
          ) {
            continue;
          }
          throw err;
        }
        await deps.queue.send({
          deliveryId,
          organizationId: envelope.organizationId,
        });
      }
    },
  };
}
