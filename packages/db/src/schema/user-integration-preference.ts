import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * user_integration_preference
 * 将来の他連携 (Slack, Notion 等) の拡張余地を残しつつ、まずは Drive 自動保存トグルのみ。
 * userId を PRIMARY KEY としてユーザー 1 行に集約する。
 */
export const userIntegrationPreference = sqliteTable(
  "user_integration_preference",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    autoSaveToDrive: integer("auto_save_to_drive", { mode: "boolean" })
      .default(false)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
);
