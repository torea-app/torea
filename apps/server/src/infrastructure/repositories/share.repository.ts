import { shareLink } from "@torea/db/schema";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type ShareLinkRow = typeof shareLink.$inferSelect;
export type ShareLinkInsert = typeof shareLink.$inferInsert;

export function createShareRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    /** 共有リンクを作成する */
    async create(data: ShareLinkInsert): Promise<ShareLinkRow> {
      const rows = await db.insert(shareLink).values(data).returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns the inserted row
      return rows[0]!;
    },

    /**
     * トークン（= ID）で共有リンクを検索する。
     * 組織スコープなし（公開アクセス用）。
     */
    async findByToken(token: string): Promise<ShareLinkRow | undefined> {
      return db.select().from(shareLink).where(eq(shareLink.id, token)).get();
    },

    /**
     * 共有リンクを ID と organizationId で検索する。
     * 管理操作（削除など）用に組織スコープを付与して検索する。
     */
    async findByIdAndOrg(
      id: string,
      organizationId: string,
    ): Promise<ShareLinkRow | undefined> {
      return db
        .select()
        .from(shareLink)
        .where(
          and(
            eq(shareLink.id, id),
            eq(shareLink.organizationId, organizationId),
          ),
        )
        .get();
    },

    /**
     * 録画に紐づく共有リンク一覧を取得する。
     * organizationId で組織スコープを付与する。
     */
    async findByRecording(
      recordingId: string,
      organizationId: string,
    ): Promise<ShareLinkRow[]> {
      return db
        .select()
        .from(shareLink)
        .where(
          and(
            eq(shareLink.recordingId, recordingId),
            eq(shareLink.organizationId, organizationId),
          ),
        )
        .all();
    },

    /**
     * 共有リンクを削除する。
     * organizationId スコープで自組織のリンクのみ削除できる。
     * 見つからない場合は false を返す（404 応答に使用）。
     */
    async delete(id: string, organizationId: string): Promise<boolean> {
      const result = await db
        .delete(shareLink)
        .where(
          and(
            eq(shareLink.id, id),
            eq(shareLink.organizationId, organizationId),
          ),
        )
        .returning({ id: shareLink.id });
      return result.length > 0;
    },
  };
}
