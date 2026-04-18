import { comment, recording, user } from "@torea/db/schema";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

type CommentInsert = {
  id: string;
  recordingId: string;
  userId: string;
  parentId: string | null;
  body: string;
  timestampMs: number | null;
};

type CommentRow = typeof comment.$inferSelect;

type CommentWithUserRow = {
  id: string;
  recordingId: string;
  userId: string;
  parentId: string | null;
  body: string;
  timestampMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string;
  userImage: string | null;
};

export function createCommentRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    /**
     * コメントを作成する。
     */
    async create(data: CommentInsert): Promise<void> {
      const now = new Date();
      await db.insert(comment).values({
        id: data.id,
        recordingId: data.recordingId,
        userId: data.userId,
        parentId: data.parentId,
        body: data.body,
        timestampMs: data.timestampMs,
        createdAt: now,
        updatedAt: now,
      });
    },

    /**
     * ID でコメントを取得する（存在確認・認可チェック用）。
     */
    async findById(id: string): Promise<CommentRow | undefined> {
      const rows = await db
        .select()
        .from(comment)
        .where(eq(comment.id, id))
        .limit(1);
      return rows[0];
    },

    /**
     * 録画に紐づくすべてのコメントをユーザー情報付きで取得する。
     * createdAt 昇順でソートし、サービス層でスレッド構造に変換する。
     */
    async findByRecording(recordingId: string): Promise<CommentWithUserRow[]> {
      return db
        .select({
          id: comment.id,
          recordingId: comment.recordingId,
          userId: comment.userId,
          parentId: comment.parentId,
          body: comment.body,
          timestampMs: comment.timestampMs,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(comment)
        .innerJoin(user, eq(comment.userId, user.id))
        .where(eq(comment.recordingId, recordingId))
        .orderBy(asc(comment.createdAt));
    },

    /**
     * コメント本文を更新する。
     */
    async update(id: string, body: string): Promise<void> {
      await db
        .update(comment)
        .set({ body, updatedAt: new Date() })
        .where(eq(comment.id, id));
    },

    /**
     * コメントを削除する。CASCADE により返信も削除される。
     */
    async delete(id: string): Promise<void> {
      await db.delete(comment).where(eq(comment.id, id));
    },

    /**
     * 組織配下の全録画に対するコメント数を集計する（ダッシュボード概要用）。
     *
     * `comment` には `organizationId` が無いため、`recording` と INNER JOIN して
     * `recording.organization_id` で必ず絞り込む（組織スコープの担保）。
     */
    async aggregateByOrganization(params: {
      organizationId: string;
      since?: Date;
    }): Promise<{ count: number }> {
      const whereCond = params.since
        ? and(
            eq(recording.organizationId, params.organizationId),
            gte(comment.createdAt, params.since),
          )
        : eq(recording.organizationId, params.organizationId);

      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(comment)
        .innerJoin(recording, eq(comment.recordingId, recording.id))
        .where(whereCond)
        .all();

      return { count: row?.count ?? 0 };
    },
  };
}
