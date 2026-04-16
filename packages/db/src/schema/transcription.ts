import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { organization } from "./auth";
import { recording } from "./recording";

export const transcription = sqliteTable(
  "transcription",
  {
    id: text("id").primaryKey(),
    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .default("pending")
      .notNull(),
    model: text("model").notNull(),
    language: text("language"),
    durationSeconds: real("duration_seconds"),
    fullText: text("full_text"),
    segments: text("segments"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
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
    index("transcription_recording_id_idx").on(table.recordingId),
    index("transcription_organization_id_idx").on(table.organizationId),
    index("transcription_status_idx").on(table.status),
  ],
);
