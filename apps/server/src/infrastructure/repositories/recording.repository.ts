import { recording } from "@screenbase/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
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
