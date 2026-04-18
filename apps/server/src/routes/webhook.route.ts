import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { WEBHOOK_EVENT_CATALOG } from "@torea/shared/webhook-events";
import { Hono } from "hono";
import { createWebhookRepository } from "../infrastructure/repositories/webhook.repository";
import { generateSecret, sha256Hex } from "../infrastructure/webhook/crypto";
import { maskSensitive } from "../infrastructure/webhook/payload-masker";
import { createWebhookSecretStore } from "../infrastructure/webhook/secret-store";
import { validateWebhookUrl } from "../infrastructure/webhook/url-validator";
import { authMiddleware } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import type { AppEnv } from "../types";
import { createWebhookService } from "../use-cases/webhook/webhook.service";
import {
  createWebhookEndpointSchema,
  listDeliveriesQuerySchema,
  listEndpointsQuerySchema,
  updateWebhookEndpointSchema,
} from "./webhook.schemas";

/**
 * 各エンドポイントで reuse するサービスインスタンス生成ヘルパ。
 * routes/ 層での composition は既存の share/recording route と同じスタイル。
 */
function buildService(env: AppEnv["Bindings"]) {
  return createWebhookService({
    repo: createWebhookRepository(env.DB),
    secretStore: createWebhookSecretStore(env.WEBHOOK_SECRET_KV),
    deliveryQueue: env.WEBHOOK_DELIVERY_QUEUE,
    generateId: createId,
    generateSecret,
    sha256Hex,
    validateUrl: validateWebhookUrl,
    mask: maskSensitive,
    now: () => new Date(),
  });
}

/**
 * Webhook 管理 API。
 *
 * 全エンドポイントに認証必須。管理系 (CRUD/rotate/test/redeliver/履歴) は
 * `settings: update` 権限でゲートし、owner/admin のみ利用可能。
 * `/events` カタログだけは認証済みユーザーなら誰でも参照可能 (UI 表示用)。
 *
 * ルート順序: Hono はパス先優先マッチングのため、`/events` `/deliveries` 等の
 * 固定パスを先に、`/:id` 系を後に宣言する。
 */
export const webhookRoute = new Hono<AppEnv>()
  .use("/*", authMiddleware)

  // =============================================
  // GET /api/webhooks/events — 購読可能イベント一覧 (認証のみ)
  // =============================================
  .get("/events", (c) => {
    return c.json({ events: WEBHOOK_EVENT_CATALOG });
  })

  // =============================================
  // GET /api/webhooks/deliveries — 配信履歴一覧
  // =============================================
  .get(
    "/deliveries",
    requirePermission("settings", "update"),
    zValidator("query", listDeliveriesQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const result = await service.listDeliveries(organizationId, query);
      return c.json(result);
    },
  )

  // =============================================
  // GET /api/webhooks/deliveries/:deliveryId — 配信詳細
  // =============================================
  .get(
    "/deliveries/:deliveryId",
    requirePermission("settings", "update"),
    async (c) => {
      const deliveryId = c.req.param("deliveryId");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const delivery = await service.getDelivery(deliveryId, organizationId);
      return c.json({ delivery });
    },
  )

  // =============================================
  // POST /api/webhooks/deliveries/:deliveryId/redeliver — 再送
  // =============================================
  .post(
    "/deliveries/:deliveryId/redeliver",
    requirePermission("settings", "update"),
    async (c) => {
      const deliveryId = c.req.param("deliveryId");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const result = await service.redeliver(deliveryId, organizationId);
      return c.json(result, 202);
    },
  )

  // =============================================
  // POST /api/webhooks — エンドポイント作成 (secret はこのレスポンスでのみ返す)
  // =============================================
  .post(
    "/",
    requirePermission("settings", "update"),
    zValidator("json", createWebhookEndpointSchema),
    async (c) => {
      const input = c.req.valid("json");
      const user = c.get("user");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const result = await service.create({
        organizationId,
        userId: user.id,
        name: input.name,
        url: input.url,
        description: input.description ?? null,
        events: input.events,
      });
      return c.json(result, 201);
    },
  )

  // =============================================
  // GET /api/webhooks — エンドポイント一覧
  // =============================================
  .get(
    "/",
    requirePermission("settings", "update"),
    zValidator("query", listEndpointsQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const result = await service.list(organizationId, query);
      return c.json(result);
    },
  )

  // =============================================
  // POST /api/webhooks/:id/rotate-secret — シークレット再生成
  // =============================================
  .post(
    "/:id/rotate-secret",
    requirePermission("settings", "update"),
    async (c) => {
      const id = c.req.param("id");
      const organizationId = c.get("activeOrganizationId");
      const service = buildService(c.env);
      const result = await service.rotateSecret(id, organizationId);
      return c.json(result);
    },
  )

  // =============================================
  // POST /api/webhooks/:id/test — テスト送信
  // =============================================
  .post("/:id/test", requirePermission("settings", "update"), async (c) => {
    const id = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");
    const service = buildService(c.env);
    const result = await service.sendTest(id, organizationId);
    return c.json(result, 202);
  })

  // =============================================
  // GET /api/webhooks/:id — エンドポイント詳細
  // =============================================
  .get("/:id", requirePermission("settings", "update"), async (c) => {
    const id = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");
    const service = buildService(c.env);
    const endpoint = await service.get(id, organizationId);
    return c.json({ endpoint });
  })

  // =============================================
  // PATCH /api/webhooks/:id — エンドポイント更新
  // =============================================
  .patch(
    "/:id",
    requirePermission("settings", "update"),
    zValidator("json", updateWebhookEndpointSchema),
    async (c) => {
      const id = c.req.param("id");
      const organizationId = c.get("activeOrganizationId");
      const patch = c.req.valid("json");
      const service = buildService(c.env);
      const endpoint = await service.update(id, organizationId, patch);
      return c.json({ endpoint });
    },
  )

  // =============================================
  // DELETE /api/webhooks/:id — エンドポイント削除
  // =============================================
  .delete("/:id", requirePermission("settings", "update"), async (c) => {
    const id = c.req.param("id");
    const organizationId = c.get("activeOrganizationId");
    const service = buildService(c.env);
    await service.delete(id, organizationId);
    return c.body(null, 204);
  });
