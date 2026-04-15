import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { recording } from "./recording";
import { shareLink } from "./share-link";

export const viewEvent = sqliteTable(
  "view_event",
  {
    id: text("id").primaryKey(),

    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),

    /** どの共有リンク経由のアクセスか。共有リンク削除後も統計は残す */
    shareLinkId: text("share_link_id").references(() => shareLink.id, {
      onDelete: "set null",
    }),

    /** ログインユーザーの場合。ユーザー削除後も統計は残す */
    viewerUserId: text("viewer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),

    /** 匿名ユーザーの Cookie 値（sb_vid）。ログインユーザーの場合は null */
    visitorId: text("visitor_id"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // 統計集計用
    index("view_event_recording_id_idx").on(table.recordingId),
    // 重複チェック用（ログインユーザー）
    index("view_event_dedup_user_idx").on(
      table.recordingId,
      table.viewerUserId,
      table.createdAt,
    ),
    // 重複チェック用（匿名ユーザー）
    index("view_event_dedup_visitor_idx").on(
      table.recordingId,
      table.visitorId,
      table.createdAt,
    ),
  ],
);
