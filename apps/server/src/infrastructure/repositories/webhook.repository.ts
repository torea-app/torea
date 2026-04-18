import { webhookDelivery, webhookEndpoint } from "@torea/db/schema";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  WebhookDeliveryStatus,
  WebhookEndpointStatus,
  WebhookEventName,
} from "../../domain/types/webhook";

export type WebhookEndpointRow = typeof webhookEndpoint.$inferSelect;
export type WebhookEndpointInsert = typeof webhookEndpoint.$inferInsert;
export type WebhookDeliveryRow = typeof webhookDelivery.$inferSelect;
export type WebhookDeliveryInsert = typeof webhookDelivery.$inferInsert;

export type EndpointUpdatePatch = Partial<{
  name: string;
  url: string;
  description: string | null;
  events: WebhookEventName[];
  status: WebhookEndpointStatus;
  disabledReason: string | null;
  secretHash: string;
  secretPrefix: string;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
}>;

export type DeliveryAttemptPatch = {
  status: WebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt?: Date | null;
  lastStatusCode?: number | null;
  lastResponseBody?: string | null;
  lastErrorMessage?: string | null;
  durationMs?: number | null;
  completedAt?: Date | null;
};

export function createWebhookRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    // --------------------------------------------------------------
    // Endpoint CRUD
    // --------------------------------------------------------------
    async createEndpoint(
      data: WebhookEndpointInsert,
    ): Promise<WebhookEndpointRow> {
      const rows = await db.insert(webhookEndpoint).values(data).returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns the inserted row
      return rows[0]!;
    },

    async findEndpointById(
      id: string,
      organizationId: string,
    ): Promise<WebhookEndpointRow | undefined> {
      return db
        .select()
        .from(webhookEndpoint)
        .where(
          and(
            eq(webhookEndpoint.id, id),
            eq(webhookEndpoint.organizationId, organizationId),
          ),
        )
        .get();
    },

    async listEndpoints(
      organizationId: string,
      opts: { limit: number; offset: number },
    ): Promise<WebhookEndpointRow[]> {
      return db
        .select()
        .from(webhookEndpoint)
        .where(eq(webhookEndpoint.organizationId, organizationId))
        .orderBy(desc(webhookEndpoint.createdAt))
        .limit(opts.limit)
        .offset(opts.offset)
        .all();
    },

    async countEndpoints(organizationId: string): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(webhookEndpoint)
        .where(eq(webhookEndpoint.organizationId, organizationId))
        .all();
      return row?.count ?? 0;
    },

    async updateEndpoint(
      id: string,
      organizationId: string,
      patch: EndpointUpdatePatch,
    ): Promise<WebhookEndpointRow | undefined> {
      const [row] = await db
        .update(webhookEndpoint)
        .set(patch)
        .where(
          and(
            eq(webhookEndpoint.id, id),
            eq(webhookEndpoint.organizationId, organizationId),
          ),
        )
        .returning();
      return row;
    },

    async deleteEndpoint(id: string, organizationId: string): Promise<boolean> {
      const result = await db
        .delete(webhookEndpoint)
        .where(
          and(
            eq(webhookEndpoint.id, id),
            eq(webhookEndpoint.organizationId, organizationId),
          ),
        )
        .returning({ id: webhookEndpoint.id });
      return result.length > 0;
    },

    /**
     * 指定組織で status=active かつ購読イベントに `eventName` を含む endpoint を返す。
     * D1 は `json_each` を readonly で利用可能だが、行数が少ない前提で
     * アプリ側で JSON 配列をフィルタする（シンプルさ優先）。
     */
    async findActiveEndpointsForEvent(
      organizationId: string,
      eventName: WebhookEventName,
    ): Promise<WebhookEndpointRow[]> {
      const rows = await db
        .select()
        .from(webhookEndpoint)
        .where(
          and(
            eq(webhookEndpoint.organizationId, organizationId),
            eq(webhookEndpoint.status, "active"),
          ),
        )
        .all();
      return rows.filter((row) => row.events.includes(eventName));
    },

    async recordSuccess(id: string, at: Date): Promise<void> {
      await db
        .update(webhookEndpoint)
        .set({
          consecutiveFailures: 0,
          lastSuccessAt: at,
        })
        .where(eq(webhookEndpoint.id, id));
    },

    /**
     * 失敗を記録し、更新後の consecutive_failures を返す。
     * D1 で atomic increment するため `sql` テンプレートを使用。
     */
    async recordFailure(id: string, at: Date): Promise<number> {
      const [row] = await db
        .update(webhookEndpoint)
        .set({
          consecutiveFailures: sql`${webhookEndpoint.consecutiveFailures} + 1`,
          lastFailureAt: at,
        })
        .where(eq(webhookEndpoint.id, id))
        .returning({
          consecutiveFailures: webhookEndpoint.consecutiveFailures,
        });
      return row?.consecutiveFailures ?? 0;
    },

    async markDisabled(id: string, reason: string): Promise<void> {
      await db
        .update(webhookEndpoint)
        .set({ status: "disabled", disabledReason: reason })
        .where(eq(webhookEndpoint.id, id));
    },

    // --------------------------------------------------------------
    // Delivery
    // --------------------------------------------------------------
    async createDelivery(
      data: WebhookDeliveryInsert,
    ): Promise<WebhookDeliveryRow> {
      const rows = await db.insert(webhookDelivery).values(data).returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns the inserted row
      return rows[0]!;
    },

    async findDeliveryById(
      id: string,
      organizationId: string,
    ): Promise<WebhookDeliveryRow | undefined> {
      return db
        .select()
        .from(webhookDelivery)
        .where(
          and(
            eq(webhookDelivery.id, id),
            eq(webhookDelivery.organizationId, organizationId),
          ),
        )
        .get();
    },

    async listDeliveries(
      organizationId: string,
      opts: {
        endpointId?: string;
        status?: WebhookDeliveryStatus;
        limit: number;
        offset: number;
      },
    ): Promise<WebhookDeliveryRow[]> {
      const conditions = [eq(webhookDelivery.organizationId, organizationId)];
      if (opts.endpointId) {
        conditions.push(eq(webhookDelivery.endpointId, opts.endpointId));
      }
      if (opts.status) {
        conditions.push(eq(webhookDelivery.status, opts.status));
      }
      return db
        .select()
        .from(webhookDelivery)
        .where(and(...conditions))
        .orderBy(desc(webhookDelivery.createdAt))
        .limit(opts.limit)
        .offset(opts.offset)
        .all();
    },

    async countDeliveries(
      organizationId: string,
      opts: {
        endpointId?: string;
        status?: WebhookDeliveryStatus;
      },
    ): Promise<number> {
      const conditions = [eq(webhookDelivery.organizationId, organizationId)];
      if (opts.endpointId) {
        conditions.push(eq(webhookDelivery.endpointId, opts.endpointId));
      }
      if (opts.status) {
        conditions.push(eq(webhookDelivery.status, opts.status));
      }
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(webhookDelivery)
        .where(and(...conditions))
        .all();
      return row?.count ?? 0;
    },

    async updateDeliveryAttempt(
      id: string,
      patch: DeliveryAttemptPatch,
    ): Promise<WebhookDeliveryRow | undefined> {
      const [row] = await db
        .update(webhookDelivery)
        .set(patch)
        .where(eq(webhookDelivery.id, id))
        .returning();
      return row;
    },

    /**
     * Cron セーフティネット用。
     * status が pending/failed で next_attempt_at <= before（= 配信すべき時刻到達済み）のものを取得。
     */
    async findPendingForRetry(
      before: Date,
      limit: number,
    ): Promise<WebhookDeliveryRow[]> {
      return db
        .select()
        .from(webhookDelivery)
        .where(
          and(
            or(
              eq(webhookDelivery.status, "pending"),
              eq(webhookDelivery.status, "failed"),
            ),
            lte(webhookDelivery.nextAttemptAt, before),
          ),
        )
        .limit(limit)
        .all();
    },

    async deleteDeliveriesByIds(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      const result = await db
        .delete(webhookDelivery)
        .where(inArray(webhookDelivery.id, ids))
        .returning({ id: webhookDelivery.id });
      return result.length;
    },
  };
}
