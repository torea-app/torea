import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth";

/**
 * webhook_endpoint
 * 組織ごとに登録された外部配信先。secret は hash + prefix のみ保存する（平文は KV 側で管理）。
 */
export const webhookEndpoint = sqliteTable(
  "webhook_endpoint",
  {
    id: text("id").primaryKey(),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),

    name: text("name").notNull(),
    url: text("url").notNull(),
    description: text("description"),

    /** 購読イベント名の配列（JSON 格納） */
    events: text("events", { mode: "json" }).$type<string[]>().notNull(),

    /** SHA-256(secret)。UI/検証用途のみで配信には使わない */
    secretHash: text("secret_hash").notNull(),
    /** 先頭 6 文字。一覧で識別表示用 */
    secretPrefix: text("secret_prefix").notNull(),

    status: text("status", {
      enum: ["active", "paused", "disabled"],
    })
      .default("active")
      .notNull(),

    /** disabled 時の理由（例: "consecutive_failures"） */
    disabledReason: text("disabled_reason"),

    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    lastFailureAt: integer("last_failure_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("webhook_endpoint_organization_id_idx").on(table.organizationId),
    index("webhook_endpoint_status_idx").on(table.status),
  ],
);

/**
 * webhook_delivery
 * 1 イベント × 1 endpoint の配信試行履歴。再送・監査のために全件永続化する。
 * 同一 (endpointId, eventId) は冪等性のため 1 行に集約。
 */
export const webhookDelivery = sqliteTable(
  "webhook_delivery",
  {
    /** X-Webhook-Id として受信側に提示する一意 ID */
    id: text("id").primaryKey(),

    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: "cascade" }),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    /** "recording.completed" 等。型は domain/types/webhook.ts の WebhookEventName */
    eventName: text("event_name").notNull(),
    eventVersion: text("event_version").notNull().default("v1"),
    /** 元イベントの一意 ID（冪等性用） */
    eventId: text("event_id").notNull(),

    /** マスク済みの配信ペイロード（JSON） */
    payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),

    status: text("status", {
      enum: ["pending", "in_progress", "success", "failed", "dead"],
    })
      .default("pending")
      .notNull(),

    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(6).notNull(),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),

    lastStatusCode: integer("last_status_code"),
    /** 先頭 2KB のみ保存する */
    lastResponseBody: text("last_response_body"),
    lastErrorMessage: text("last_error_message"),
    durationMs: integer("duration_ms"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("webhook_delivery_endpoint_id_idx").on(table.endpointId),
    index("webhook_delivery_organization_id_idx").on(table.organizationId),
    index("webhook_delivery_status_idx").on(table.status),
    index("webhook_delivery_created_at_idx").on(table.createdAt),
    uniqueIndex("webhook_delivery_endpoint_event_uq").on(
      table.endpointId,
      table.eventId,
    ),
  ],
);
