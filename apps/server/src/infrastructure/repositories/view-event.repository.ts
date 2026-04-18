import { recording, viewEvent } from "@torea/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type ViewEventInsert = typeof viewEvent.$inferInsert;

export function createViewEventRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    /**
     * 視聴イベントを挿入する。
     */
    async create(data: ViewEventInsert): Promise<void> {
      await db.insert(viewEvent).values(data);
    },

    /**
     * 録画の視聴統計（総視聴回数・ユニーク視聴者数）を取得する。
     *
     * ユニーク視聴者数は COALESCE(viewer_user_id, visitor_id) の DISTINCT COUNT で算出。
     * ログインユーザーは user_id、匿名ユーザーは visitor_id（Cookie）で識別する。
     */
    async getStats(
      recordingId: string,
    ): Promise<{ totalViews: number; uniqueViewers: number }> {
      const rows = await db
        .select({
          totalViews: sql<number>`count(*)`,
          uniqueViewers: sql<number>`count(distinct coalesce(${viewEvent.viewerUserId}, ${viewEvent.visitorId}))`,
        })
        .from(viewEvent)
        .where(eq(viewEvent.recordingId, recordingId))
        .all();
      const row = rows[0];
      return {
        totalViews: row?.totalViews ?? 0,
        uniqueViewers: row?.uniqueViewers ?? 0,
      };
    },

    /**
     * 組織配下の全録画に対する視聴イベントを集計する（ダッシュボード概要用）。
     *
     * `view_event` には `organizationId` が無いため、`recording` と INNER JOIN して
     * `recording.organization_id` で必ず絞り込む（組織スコープの担保）。
     *
     * - `totalViews` は期間内イベント総数
     * - `uniqueViewers` は `coalesce(viewer_user_id, visitor_id)` の DISTINCT COUNT
     *   （getStats と同じロジック。両方 null のレコードは DISTINCT の対象から外れる）
     */
    async aggregateByOrganization(params: {
      organizationId: string;
      since?: Date;
    }): Promise<{ totalViews: number; uniqueViewers: number }> {
      const whereCond = params.since
        ? and(
            eq(recording.organizationId, params.organizationId),
            gte(viewEvent.createdAt, params.since),
          )
        : eq(recording.organizationId, params.organizationId);

      const [row] = await db
        .select({
          totalViews: sql<number>`count(*)`,
          uniqueViewers: sql<number>`count(distinct coalesce(${viewEvent.viewerUserId}, ${viewEvent.visitorId}))`,
        })
        .from(viewEvent)
        .innerJoin(recording, eq(viewEvent.recordingId, recording.id))
        .where(whereCond)
        .all();

      return {
        totalViews: row?.totalViews ?? 0,
        uniqueViewers: row?.uniqueViewers ?? 0,
      };
    },

    /**
     * 指定期間内に同一ビューアーの視聴イベントが存在するか確認する。
     * 重複排除（dedup）に使用する。
     *
     * @param viewerUserId - ログインユーザーの場合に指定
     * @param visitorId - 匿名ユーザーの場合に指定（Cookie sb_vid の値）
     * @param since - この日時以降のイベントを検索対象とする
     * @returns 重複イベントが存在する場合は true
     */
    async existsRecentByViewer(params: {
      recordingId: string;
      viewerUserId: string | null;
      visitorId: string | null;
      since: Date;
    }): Promise<boolean> {
      // viewerUserId を優先。両方 null の場合は重複チェック不可（呼び出し側で防止）
      const viewerCondition = params.viewerUserId
        ? eq(viewEvent.viewerUserId, params.viewerUserId)
        : params.visitorId
          ? eq(viewEvent.visitorId, params.visitorId)
          : null;

      if (!viewerCondition) {
        return false;
      }

      const row = await db
        .select({ id: viewEvent.id })
        .from(viewEvent)
        .where(
          and(
            eq(viewEvent.recordingId, params.recordingId),
            viewerCondition,
            gte(viewEvent.createdAt, params.since),
          ),
        )
        .limit(1)
        .get();

      return !!row;
    },
  };
}
