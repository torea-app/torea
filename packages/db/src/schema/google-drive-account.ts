import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

/**
 * google_drive_account
 * ユーザー単位の Google Drive 連携 (1:1)。
 * トークンは AES-256-GCM で暗号化して保存（"base64(IV):base64(ciphertext+tag)" 形式）。
 */
export const googleDriveAccount = sqliteTable(
  "google_drive_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Google 側のユニーク識別子 (id_token の sub)。連携先のアカウント切り替え検知用。 */
    googleSubject: text("google_subject").notNull(),
    googleEmail: text("google_email").notNull(),
    /** base64(IV) || ":" || base64(ciphertext+tag) */
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    /** Google が返す scope (space-separated) */
    scope: text("scope").notNull(),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }).notNull(),
    /** Google から invalid_grant を受領した時に "revoked" に遷移 */
    status: text("status", { enum: ["active", "revoked"] })
      .default("active")
      .notNull(),
    /** Drive 上の "Torea" ルートフォルダ ID。最初のエクスポート時に作成して保存。 */
    rootFolderId: text("root_folder_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("google_drive_account_user_id_idx").on(table.userId),
    index("google_drive_account_status_idx").on(table.status),
  ],
);
