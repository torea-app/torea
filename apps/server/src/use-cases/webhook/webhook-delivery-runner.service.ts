import type { createWebhookRepository } from "../../infrastructure/repositories/webhook.repository";
import type {
  DispatchResult,
  dispatchWebhook as dispatchWebhookFn,
} from "../../infrastructure/webhook/dispatcher";
import type { WebhookSecretStore } from "../../infrastructure/webhook/secret-store";

type Repo = ReturnType<typeof createWebhookRepository>;
type DeliveryQueue = Queue<{ deliveryId: string; organizationId: string }>;

type Deps = {
  repo: Repo;
  secretStore: WebhookSecretStore;
  queue: DeliveryQueue;
  dispatch: typeof dispatchWebhookFn;
  now: () => Date;
};

/** 指数バックオフの各試行間隔（秒）。index = attemptCount - 1 */
export const WEBHOOK_BACKOFF_SECONDS = [30, 120, 600, 3600, 21600];
export const WEBHOOK_MAX_ATTEMPTS = 6;
export const WEBHOOK_DISABLE_THRESHOLD = 10;

function jitter(seconds: number): number {
  // ±20% のジッタ
  const variance = seconds * 0.2;
  const delta = (Math.random() * 2 - 1) * variance;
  return Math.max(1, Math.floor(seconds + delta));
}

/**
 * Queue consumer から 1 件の delivery を実行するランナー。
 * - KV から secret を取り出して dispatcher に渡す
 * - 成功/失敗に応じて delivery 行を更新
 * - 失敗時は delayed enqueue で retry をスケジュール
 * - endpoint の連続失敗が閾値に達したら自動 disable
 */
export function createWebhookDeliveryRunner(deps: Deps) {
  return {
    async run(deliveryId: string, organizationId: string): Promise<void> {
      const delivery = await deps.repo.findDeliveryById(
        deliveryId,
        organizationId,
      );
      if (!delivery) return;
      if (delivery.status === "success" || delivery.status === "dead") return;

      const endpoint = await deps.repo.findEndpointById(
        delivery.endpointId,
        organizationId,
      );
      if (!endpoint) {
        await deps.repo.updateDeliveryAttempt(delivery.id, {
          status: "dead",
          attemptCount: delivery.attemptCount,
          lastErrorMessage: "endpoint not found",
          completedAt: deps.now(),
        });
        return;
      }
      if (endpoint.status !== "active") {
        await deps.repo.updateDeliveryAttempt(delivery.id, {
          status: "dead",
          attemptCount: delivery.attemptCount,
          lastErrorMessage: `endpoint status is ${endpoint.status}`,
          completedAt: deps.now(),
        });
        return;
      }

      const secret = await deps.secretStore.get(endpoint.id);
      if (!secret) {
        await deps.repo.updateDeliveryAttempt(delivery.id, {
          status: "dead",
          attemptCount: delivery.attemptCount,
          lastErrorMessage: "webhook secret missing (KV key absent)",
          completedAt: deps.now(),
        });
        return;
      }

      const nextAttempt = delivery.attemptCount + 1;
      await deps.repo.updateDeliveryAttempt(delivery.id, {
        status: "in_progress",
        attemptCount: nextAttempt,
      });

      const body = JSON.stringify({
        id: delivery.eventId,
        name: delivery.eventName,
        version: delivery.eventVersion,
        createdAt: delivery.createdAt.toISOString(),
        organizationId: delivery.organizationId,
        payload: delivery.payload,
      });

      const result: DispatchResult = await deps.dispatch({
        url: endpoint.url,
        secret,
        deliveryId: delivery.id,
        eventId: delivery.eventId,
        eventName: delivery.eventName,
        eventVersion: "v1",
        body,
      });

      const now = deps.now();

      if (result.ok) {
        await deps.repo.updateDeliveryAttempt(delivery.id, {
          status: "success",
          attemptCount: nextAttempt,
          lastStatusCode: result.status,
          lastResponseBody: result.responseBody,
          lastErrorMessage: null,
          durationMs: result.durationMs,
          completedAt: now,
        });
        await deps.repo.recordSuccess(endpoint.id, now);
        return;
      }

      // 失敗: リトライ判定
      const hasRetryBudget =
        nextAttempt < (delivery.maxAttempts ?? WEBHOOK_MAX_ATTEMPTS);
      const backoffIndex = nextAttempt - 1;
      const backoffSeconds = WEBHOOK_BACKOFF_SECONDS[backoffIndex];

      if (hasRetryBudget && backoffSeconds !== undefined) {
        const delay = jitter(backoffSeconds);
        await deps.repo.updateDeliveryAttempt(delivery.id, {
          status: "failed",
          attemptCount: nextAttempt,
          lastStatusCode: result.status,
          lastResponseBody: result.responseBody,
          lastErrorMessage: result.errorMessage,
          durationMs: result.durationMs,
          nextAttemptAt: new Date(now.getTime() + delay * 1000),
        });
        await deps.queue.send(
          { deliveryId: delivery.id, organizationId },
          { delaySeconds: delay },
        );
        return;
      }

      // 上限到達 → dead 化 + endpoint 連続失敗カウント
      await deps.repo.updateDeliveryAttempt(delivery.id, {
        status: "dead",
        attemptCount: nextAttempt,
        lastStatusCode: result.status,
        lastResponseBody: result.responseBody,
        lastErrorMessage: result.errorMessage,
        durationMs: result.durationMs,
        completedAt: now,
      });
      const consecutive = await deps.repo.recordFailure(endpoint.id, now);
      if (consecutive >= WEBHOOK_DISABLE_THRESHOLD) {
        await deps.repo.markDisabled(endpoint.id, "consecutive_failures");
      }
    },
  };
}
