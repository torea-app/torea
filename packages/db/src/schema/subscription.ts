// SOURCE: @better-auth/stripe@1.6.9 の subscription schema を Drizzle に取り込んだもの。
// 取得スナップショット: docs/better-auth-stripe-schema-snapshot.md
// プラグインを上げた際は同スナップショットを再取得し、新規 field の有無を確認すること。
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const subscription = sqliteTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    /** customerType: "user" のため user.id と一致する。 */
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    status: text("status").notNull().default("incomplete"),
    periodStart: integer("period_start", { mode: "timestamp_ms" }),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }),
    trialStart: integer("trial_start", { mode: "timestamp_ms" }),
    trialEnd: integer("trial_end", { mode: "timestamp_ms" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", {
      mode: "boolean",
    }).default(false),
    cancelAt: integer("cancel_at", { mode: "timestamp_ms" }),
    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    seats: integer("seats"),
    billingInterval: text("billing_interval"),
    stripeScheduleId: text("stripe_schedule_id"),
  },
  (table) => [
    index("subscription_referenceId_idx").on(table.referenceId),
    index("subscription_stripeCustomerId_idx").on(table.stripeCustomerId),
    index("subscription_status_idx").on(table.status),
  ],
);
