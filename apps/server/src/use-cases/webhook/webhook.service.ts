import {
  NotFoundError,
  WebhookUrlInvalidError,
} from "../../domain/errors/domain.error";
import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
  WebhookEndpoint,
  WebhookEndpointStatus,
  WebhookEventName,
} from "../../domain/types/webhook";
import type { WebhookEventEnvelope } from "../../domain/types/webhook-events";
import type {
  createWebhookRepository,
  WebhookDeliveryRow,
  WebhookEndpointRow,
} from "../../infrastructure/repositories/webhook.repository";
import type {
  generateSecret as generateSecretFn,
  sha256Hex as sha256HexFn,
} from "../../infrastructure/webhook/crypto";
import type { maskSensitive as maskSensitiveFn } from "../../infrastructure/webhook/payload-masker";
import type { WebhookSecretStore } from "../../infrastructure/webhook/secret-store";
import type { validateWebhookUrl as validateWebhookUrlFn } from "../../infrastructure/webhook/url-validator";

type Repo = ReturnType<typeof createWebhookRepository>;

type TestQueueMessage = { deliveryId: string; organizationId: string };
type DeliveryQueue = Queue<TestQueueMessage>;

type Deps = {
  repo: Repo;
  secretStore: WebhookSecretStore;
  deliveryQueue: DeliveryQueue;
  generateId: () => string;
  generateSecret: typeof generateSecretFn;
  sha256Hex: typeof sha256HexFn;
  validateUrl: typeof validateWebhookUrlFn;
  mask: typeof maskSensitiveFn;
  now: () => Date;
};

type CreateEndpointInput = {
  organizationId: string;
  userId: string;
  name: string;
  url: string;
  description?: string | null;
  events: WebhookEventName[];
};

type UpdateEndpointInput = {
  name?: string;
  url?: string;
  description?: string | null;
  events?: WebhookEventName[];
  status?: "active" | "paused";
};

type ListDeliveriesInput = {
  endpointId?: string;
  status?: WebhookDeliveryStatus;
  limit: number;
  offset: number;
};

function toEndpointDomain(row: WebhookEndpointRow): WebhookEndpoint {
  return {
    id: row.id,
    organizationId: row.organizationId,
    createdByUserId: row.createdByUserId,
    name: row.name,
    url: row.url,
    description: row.description,
    events: row.events as WebhookEventName[],
    secretPrefix: row.secretPrefix,
    status: row.status as WebhookEndpointStatus,
    disabledReason: row.disabledReason,
    consecutiveFailures: row.consecutiveFailures,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDeliveryDomain(row: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    endpointId: row.endpointId,
    organizationId: row.organizationId,
    eventName: row.eventName as WebhookEventName,
    eventVersion: row.eventVersion as "v1",
    eventId: row.eventId,
    payload: row.payload,
    status: row.status as WebhookDeliveryStatus,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt,
    lastStatusCode: row.lastStatusCode,
    lastResponseBody: row.lastResponseBody,
    lastErrorMessage: row.lastErrorMessage,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

export function createWebhookService(deps: Deps) {
  async function ensureEndpoint(
    id: string,
    organizationId: string,
  ): Promise<WebhookEndpointRow> {
    const row = await deps.repo.findEndpointById(id, organizationId);
    if (!row) throw new NotFoundError("WebhookEndpoint", id);
    return row;
  }

  return {
    async create(
      input: CreateEndpointInput,
    ): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
      const validation = deps.validateUrl(input.url);
      if (!validation.ok) {
        throw new WebhookUrlInvalidError(validation.reason);
      }

      const secret = deps.generateSecret();
      const secretHash = await deps.sha256Hex(secret);
      const secretPrefix = secret.slice(0, 10); // "whsec_" + 先頭 4 文字

      const id = deps.generateId();
      const row = await deps.repo.createEndpoint({
        id,
        organizationId: input.organizationId,
        createdByUserId: input.userId,
        name: input.name,
        url: validation.url.toString(),
        description: input.description ?? null,
        events: input.events,
        secretHash,
        secretPrefix,
        status: "active",
      });

      await deps.secretStore.put(id, secret);

      return { endpoint: toEndpointDomain(row), secret };
    },

    async list(
      organizationId: string,
      opts: { limit: number; offset: number },
    ): Promise<{ endpoints: WebhookEndpoint[]; total: number }> {
      const [rows, total] = await Promise.all([
        deps.repo.listEndpoints(organizationId, opts),
        deps.repo.countEndpoints(organizationId),
      ]);
      return { endpoints: rows.map(toEndpointDomain), total };
    },

    async get(id: string, organizationId: string): Promise<WebhookEndpoint> {
      const row = await ensureEndpoint(id, organizationId);
      return toEndpointDomain(row);
    },

    async update(
      id: string,
      organizationId: string,
      patch: UpdateEndpointInput,
    ): Promise<WebhookEndpoint> {
      await ensureEndpoint(id, organizationId);

      const updates: Parameters<Repo["updateEndpoint"]>[2] = {};
      if (patch.name !== undefined) updates.name = patch.name;
      if (patch.description !== undefined)
        updates.description = patch.description;
      if (patch.events !== undefined) updates.events = patch.events;
      if (patch.status !== undefined) {
        updates.status = patch.status;
        // active に戻した場合は disabled 理由・連続失敗をリセット
        if (patch.status === "active") {
          updates.disabledReason = null;
          updates.consecutiveFailures = 0;
        }
      }
      if (patch.url !== undefined) {
        const validation = deps.validateUrl(patch.url);
        if (!validation.ok) {
          throw new WebhookUrlInvalidError(validation.reason);
        }
        updates.url = validation.url.toString();
      }

      const updated = await deps.repo.updateEndpoint(
        id,
        organizationId,
        updates,
      );
      if (!updated) throw new NotFoundError("WebhookEndpoint", id);
      return toEndpointDomain(updated);
    },

    async delete(id: string, organizationId: string): Promise<void> {
      await ensureEndpoint(id, organizationId);
      const deleted = await deps.repo.deleteEndpoint(id, organizationId);
      if (!deleted) throw new NotFoundError("WebhookEndpoint", id);
      await deps.secretStore.delete(id);
    },

    async rotateSecret(
      id: string,
      organizationId: string,
    ): Promise<{ secret: string }> {
      await ensureEndpoint(id, organizationId);
      const secret = deps.generateSecret();
      const secretHash = await deps.sha256Hex(secret);
      const secretPrefix = secret.slice(0, 10);
      const updated = await deps.repo.updateEndpoint(id, organizationId, {
        secretHash,
        secretPrefix,
      });
      if (!updated) throw new NotFoundError("WebhookEndpoint", id);
      await deps.secretStore.put(id, secret);
      return { secret };
    },

    async listDeliveries(
      organizationId: string,
      opts: ListDeliveriesInput,
    ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
      const [rows, total] = await Promise.all([
        deps.repo.listDeliveries(organizationId, opts),
        deps.repo.countDeliveries(organizationId, {
          endpointId: opts.endpointId,
          status: opts.status,
        }),
      ]);
      return {
        deliveries: rows.map(toDeliveryDomain),
        total,
      };
    },

    async getDelivery(
      deliveryId: string,
      organizationId: string,
    ): Promise<WebhookDelivery> {
      const row = await deps.repo.findDeliveryById(deliveryId, organizationId);
      if (!row) throw new NotFoundError("WebhookDelivery", deliveryId);
      return toDeliveryDomain(row);
    },

    /**
     * テスト送信。合成イベント `recording.created` 相当の payload を
     * 新しい delivery として作成して Queue に投入する。
     */
    async sendTest(
      endpointId: string,
      organizationId: string,
    ): Promise<{ deliveryId: string }> {
      const endpoint = await ensureEndpoint(endpointId, organizationId);
      const eventId = deps.generateId();
      const deliveryId = deps.generateId();
      const now = deps.now();

      const envelope: WebhookEventEnvelope<"recording.created"> = {
        id: eventId,
        name: "recording.created",
        version: "v1",
        createdAt: now.toISOString(),
        organizationId,
        payload: {
          recordingId: "test-recording-id",
          userId: endpoint.createdByUserId,
          title: "Torea Webhook テスト送信",
          createdAt: now.toISOString(),
        },
      };

      await deps.repo.createDelivery({
        id: deliveryId,
        endpointId: endpoint.id,
        organizationId,
        eventName: envelope.name,
        eventVersion: envelope.version,
        eventId,
        payload: deps.mask(envelope),
        status: "pending",
        attemptCount: 0,
        maxAttempts: 6,
        nextAttemptAt: now,
      });
      await deps.deliveryQueue.send({ deliveryId, organizationId });

      return { deliveryId };
    },

    /**
     * 既存 delivery を再送する。新しい delivery 行 + event_id を発番して
     * unique index 衝突を避けつつ Queue に投入。
     */
    async redeliver(
      deliveryId: string,
      organizationId: string,
    ): Promise<{ newDeliveryId: string }> {
      const source = await deps.repo.findDeliveryById(
        deliveryId,
        organizationId,
      );
      if (!source) throw new NotFoundError("WebhookDelivery", deliveryId);

      const newId = deps.generateId();
      const newEventId = deps.generateId();
      const now = deps.now();

      await deps.repo.createDelivery({
        id: newId,
        endpointId: source.endpointId,
        organizationId,
        eventName: source.eventName,
        eventVersion: source.eventVersion,
        eventId: newEventId,
        payload: source.payload,
        status: "pending",
        attemptCount: 0,
        maxAttempts: 6,
        nextAttemptAt: now,
      });
      await deps.deliveryQueue.send({
        deliveryId: newId,
        organizationId,
      });

      return { newDeliveryId: newId };
    },
  };
}
