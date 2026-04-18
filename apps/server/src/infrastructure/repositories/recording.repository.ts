import { recording } from "@torea/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type RecordingRow = typeof recording.$inferSelect;
export type RecordingInsert = typeof recording.$inferInsert;

export function createRecordingRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    async create(data: RecordingInsert): Promise<RecordingRow> {
      const rows = await db.insert(recording).values(data).returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns the inserted row
      return rows[0]!;
    },

    async findById(
      id: string,
      organizationId: string,
    ): Promise<RecordingRow | undefined> {
      return db
        .select()
        .from(recording)
        .where(
          and(
            eq(recording.id, id),
            eq(recording.organizationId, organizationId),
          ),
        )
        .get();
    },

    async findByOrganization(
      organizationId: string,
      options: { limit: number; offset: number },
    ): Promise<RecordingRow[]> {
      return db
        .select()
        .from(recording)
        .where(eq(recording.organizationId, organizationId))
        .orderBy(desc(recording.createdAt))
        .limit(options.limit)
        .offset(options.offset)
        .all();
    },

    async countByOrganization(organizationId: string): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)` })
        .from(recording)
        .where(eq(recording.organizationId, organizationId))
        .all();
      return row?.count ?? 0;
    },

    /**
     * 組織配下の録画を集計する（ダッシュボード概要用）。
     * `since` 指定時は `created_at >= since` で期間を絞り込む。
     *
     * - `count` は全 status を対象
     * - `totalDurationMs` / `totalFileSize` は `completed` / `processing` のみ対象
     *   （`uploading` / `failed` はメタデータが欠損/不完全のため除外）
     * - `statusBreakdown` は status 別の件数
     */
    async aggregateByOrganization(params: {
      organizationId: string;
      since?: Date;
    }): Promise<{
      count: number;
      totalDurationMs: number;
      totalFileSize: number;
      statusBreakdown: {
        uploading: number;
        processing: number;
        completed: number;
        failed: number;
      };
    }> {
      const whereCond = params.since
        ? and(
            eq(recording.organizationId, params.organizationId),
            gte(recording.createdAt, params.since),
          )
        : eq(recording.organizationId, params.organizationId);

      const [row] = await db
        .select({
          count: sql<number>`count(*)`,
          totalDurationMs: sql<number>`coalesce(sum(case when ${recording.status} in ('completed','processing') then ${recording.durationMs} else 0 end), 0)`,
          totalFileSize: sql<number>`coalesce(sum(case when ${recording.status} in ('completed','processing') then ${recording.fileSize} else 0 end), 0)`,
          uploading: sql<number>`coalesce(sum(case when ${recording.status} = 'uploading' then 1 else 0 end), 0)`,
          processing: sql<number>`coalesce(sum(case when ${recording.status} = 'processing' then 1 else 0 end), 0)`,
          completed: sql<number>`coalesce(sum(case when ${recording.status} = 'completed' then 1 else 0 end), 0)`,
          failed: sql<number>`coalesce(sum(case when ${recording.status} = 'failed' then 1 else 0 end), 0)`,
        })
        .from(recording)
        .where(whereCond)
        .all();

      return {
        count: row?.count ?? 0,
        totalDurationMs: row?.totalDurationMs ?? 0,
        totalFileSize: row?.totalFileSize ?? 0,
        statusBreakdown: {
          uploading: row?.uploading ?? 0,
          processing: row?.processing ?? 0,
          completed: row?.completed ?? 0,
          failed: row?.failed ?? 0,
        },
      };
    },

    async updateStatus(
      id: string,
      organizationId: string,
      data: {
        status: "processing" | "completed" | "failed";
        fileSize?: number;
        durationMs?: number;
        completedAt?: Date;
      },
    ): Promise<RecordingRow | undefined> {
      const [row] = await db
        .update(recording)
        .set(data)
        .where(
          and(
            eq(recording.id, id),
            eq(recording.organizationId, organizationId),
          ),
        )
        .returning();
      return row;
    },

    async updateThumbnail(
      id: string,
      organizationId: string,
      thumbnailR2Key: string,
    ): Promise<boolean> {
      const result = await db
        .update(recording)
        .set({ thumbnailR2Key })
        .where(
          and(
            eq(recording.id, id),
            eq(recording.organizationId, organizationId),
          ),
        )
        .returning({ id: recording.id });
      return result.length > 0;
    },

    async findByIds(
      ids: string[],
      organizationId: string,
    ): Promise<RecordingRow[]> {
      if (ids.length === 0) return [];
      return db
        .select()
        .from(recording)
        .where(
          and(
            inArray(recording.id, ids),
            eq(recording.organizationId, organizationId),
          ),
        )
        .all();
    },

    async deleteMany(ids: string[], organizationId: string): Promise<number> {
      if (ids.length === 0) return 0;
      const result = await db
        .delete(recording)
        .where(
          and(
            inArray(recording.id, ids),
            eq(recording.organizationId, organizationId),
          ),
        )
        .returning({ id: recording.id });
      return result.length;
    },

    async delete(id: string, organizationId: string): Promise<boolean> {
      const result = await db
        .delete(recording)
        .where(
          and(
            eq(recording.id, id),
            eq(recording.organizationId, organizationId),
          ),
        )
        .returning({ id: recording.id });
      return result.length > 0;
    },
  };
}
