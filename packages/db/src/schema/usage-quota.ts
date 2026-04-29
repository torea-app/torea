import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * 1 ユーザー × 1 期間（月）あたりの利用量を記録する。
 * `periodStart` は @torea/shared の getCurrentPeriodStart() の戻り値（毎月 1 日 00:00 JST の UTC 表現）。
 *
 * 月初に新規行を作成し、過去行は履歴として残す。プラン降格時の不正確な集計を避けるため、
 * 行は plan 列も持つ（その期間中に「どのプランで」消費したか）。
 */
export const usageQuota = sqliteTable(
  "usage_quota",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
    /** 期間開始時点の plan スナップショット。 */
    plan: text("plan").notNull(),
    /** 浮動小数点を避けるため、ミリ秒を 60 で割った値（= ミリ分）を整数で保持する。 */
    recordingMinutesUsedX1000: integer("recording_minutes_used_x1000")
      .notNull()
      .default(0),
    recordingCount: integer("recording_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_quota_user_period_uidx").on(
      table.userId,
      table.periodStart,
    ),
    index("usage_quota_userId_idx").on(table.userId),
  ],
);
