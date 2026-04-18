import type { createWebhookRepository } from "../../infrastructure/repositories/webhook.repository";

type Repo = ReturnType<typeof createWebhookRepository>;
type DeliveryQueue = Queue<{ deliveryId: string; organizationId: string }>;

type Deps = {
  repo: Repo;
  queue: DeliveryQueue;
  now: () => Date;
};

/**
 * Cron セーフティネット。
 *
 * `next_attempt_at <= now` を満たす pending / failed delivery を
 * Queue に再投入する。Queue メッセージ消失や Worker 再デプロイ時の
 * 取りこぼしを救済する。
 *
 * 1 回の起動で最大 100 件まで処理 (Workers サブリクエスト制限を考慮)。
 */
const RESCAN_LIMIT = 100;

export function createWebhookRetryScheduler(deps: Deps) {
  return {
    async runOnce(): Promise<{ rescheduled: number }> {
      const now = deps.now();
      const pendings = await deps.repo.findPendingForRetry(now, RESCAN_LIMIT);
      if (pendings.length === 0) return { rescheduled: 0 };

      let rescheduled = 0;
      for (const delivery of pendings) {
        try {
          await deps.queue.send({
            deliveryId: delivery.id,
            organizationId: delivery.organizationId,
          });
          rescheduled++;
        } catch (err) {
          console.error(`Failed to re-enqueue delivery ${delivery.id}:`, err);
        }
      }
      return { rescheduled };
    },
  };
}
