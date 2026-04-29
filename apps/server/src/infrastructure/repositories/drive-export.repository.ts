import { driveExport } from "@torea/db/schema";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type {
  DriveExportKind,
  DriveExportTriggeredBy,
} from "../../domain/types/google-drive";

export type DriveExportRow = typeof driveExport.$inferSelect;
export type DriveExportInsert = typeof driveExport.$inferInsert;

export type DriveExportRepository = ReturnType<
  typeof createDriveExportRepository
>;

export function createDriveExportRepository(d1: D1Database) {
  const db = drizzle(d1);
  return {
    async findById(id: string): Promise<DriveExportRow | undefined> {
      return db.select().from(driveExport).where(eq(driveExport.id, id)).get();
    },

    async findByRecordingId(
      recordingId: string,
      organizationId: string,
    ): Promise<DriveExportRow[]> {
      return db
        .select()
        .from(driveExport)
        .where(
          and(
            eq(driveExport.recordingId, recordingId),
            eq(driveExport.organizationId, organizationId),
          ),
        )
        .all();
    },

    async findByRecordingAndKind(
      recordingId: string,
      kind: DriveExportKind,
    ): Promise<DriveExportRow | undefined> {
      return db
        .select()
        .from(driveExport)
        .where(
          and(
            eq(driveExport.recordingId, recordingId),
            eq(driveExport.kind, kind),
          ),
        )
        .get();
    },

    /**
     * (recordingId, kind) のユニーク制約に基づいて upsert する。
     * 再エクスポート時は status=queued にリセットし、retryCount/error/bytes をクリアする。
     */
    async upsertQueued(
      data: DriveExportInsert & { triggeredBy: DriveExportTriggeredBy },
    ): Promise<DriveExportRow> {
      const rows = await db
        .insert(driveExport)
        .values(data)
        .onConflictDoUpdate({
          target: [driveExport.recordingId, driveExport.kind],
          set: {
            status: "queued",
            triggeredBy: data.triggeredBy,
            connectedAccountUserId: data.connectedAccountUserId,
            errorCode: null,
            errorMessage: null,
            retryCount: 0,
            startedAt: null,
            completedAt: null,
            bytesUploaded: 0,
            bytesTotal: null,
            driveFileId: null,
            driveWebViewLink: null,
          },
        })
        .returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns a row
      return rows[0]!;
    },

    async setUploading(
      id: string,
      params: { bytesTotal: number },
    ): Promise<void> {
      await db
        .update(driveExport)
        .set({
          status: "uploading",
          startedAt: new Date(),
          bytesTotal: params.bytesTotal,
        })
        .where(eq(driveExport.id, id));
    },

    async setCompleted(
      id: string,
      params: { driveFileId: string; webViewLink: string; bytes: number },
    ): Promise<void> {
      await db
        .update(driveExport)
        .set({
          status: "completed",
          driveFileId: params.driveFileId,
          driveWebViewLink: params.webViewLink,
          bytesUploaded: params.bytes,
          completedAt: new Date(),
        })
        .where(eq(driveExport.id, id));
    },

    async setFailed(
      id: string,
      params: { errorCode: string; errorMessage: string; retryCount: number },
    ): Promise<void> {
      await db
        .update(driveExport)
        .set({
          status: "failed",
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
          retryCount: params.retryCount,
        })
        .where(eq(driveExport.id, id));
    },

    async incrementRetryCount(id: string): Promise<number> {
      const row = await db
        .select({ retryCount: driveExport.retryCount })
        .from(driveExport)
        .where(eq(driveExport.id, id))
        .get();
      const next = (row?.retryCount ?? 0) + 1;
      await db
        .update(driveExport)
        .set({ retryCount: next })
        .where(eq(driveExport.id, id));
      return next;
    },
  };
}
