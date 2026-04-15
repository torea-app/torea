import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth";

export const recording = sqliteTable(
  "recording",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["uploading", "processing", "completed", "failed"],
    })
      .default("uploading")
      .notNull(),
    r2Key: text("r2_key").notNull(),
    uploadId: text("upload_id").notNull(),
    fileSize: integer("file_size"),
    durationMs: integer("duration_ms"),
    mimeType: text("mime_type").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    thumbnailR2Key: text("thumbnail_r2_key"),
  },
  (table) => [
    index("recording_organizationId_idx").on(table.organizationId),
    index("recording_userId_idx").on(table.userId),
    index("recording_status_idx").on(table.status),
  ],
);
