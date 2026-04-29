import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth";
import { recording } from "./recording";

/**
 * drive_export
 * 1 録画につき最大 2 行 (kind = "video" / "transcript")。
 * 再実行時は (recordingId, kind) で同じ行を upsert する。
 */
export const driveExport = sqliteTable(
  "drive_export",
  {
    id: text("id").primaryKey(),
    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** どのユーザーの Drive 連携を使ってアップロードしたか (= 通常は録画作成者) */
    connectedAccountUserId: text("connected_account_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["video", "transcript"] }).notNull(),
    status: text("status", {
      enum: ["queued", "uploading", "completed", "failed"],
    })
      .default("queued")
      .notNull(),
    triggeredBy: text("triggered_by", { enum: ["manual", "auto"] }).notNull(),
    /** 成功時のみセット */
    driveFileId: text("drive_file_id"),
    driveWebViewLink: text("drive_web_view_link"),
    /** 失敗時のみセット */
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    bytesUploaded: integer("bytes_uploaded").default(0).notNull(),
    bytesTotal: integer("bytes_total"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("drive_export_recording_id_idx").on(table.recordingId),
    index("drive_export_organization_id_idx").on(table.organizationId),
    index("drive_export_status_idx").on(table.status),
    uniqueIndex("drive_export_recording_kind_uidx").on(
      table.recordingId,
      table.kind,
    ),
  ],
);
