import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth";
import { recording } from "./recording";

export const shareLink = sqliteTable(
  "share_link",
  {
    /** CUID2。URL のトークンとしてもそのまま使用する */
    id: text("id").primaryKey(),

    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * 共有タイプ:
     *   org_members        → 同組織メンバーのみ（ログイン必須）
     *   password_protected → パスワード認証（ログイン不要）
     */
    type: text("type", {
      enum: ["org_members", "password_protected"],
    }).notNull(),

    /**
     * PBKDF2-SHA256 ハッシュ（hex 文字列）。
     * type === 'org_members' の場合は null。
     */
    passwordHash: text("password_hash"),

    /**
     * パスワードハッシュ用ソルト（crypto.randomUUID() で生成）。
     * type === 'org_members' の場合は null。
     */
    passwordSalt: text("password_salt"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),

    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("share_link_recording_id_idx").on(table.recordingId),
    index("share_link_organization_id_idx").on(table.organizationId),
  ],
);
