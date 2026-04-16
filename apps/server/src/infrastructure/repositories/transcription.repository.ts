import { transcription } from "@screenbase/db/schema";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type TranscriptionRow = typeof transcription.$inferSelect;
export type TranscriptionInsert = typeof transcription.$inferInsert;

export function createTranscriptionRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    async create(data: TranscriptionInsert): Promise<TranscriptionRow> {
      const rows = await db.insert(transcription).values(data).returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns the inserted row
      return rows[0]!;
    },

    async findByRecordingId(
      recordingId: string,
      organizationId: string,
    ): Promise<TranscriptionRow | undefined> {
      return db
        .select()
        .from(transcription)
        .where(
          and(
            eq(transcription.recordingId, recordingId),
            eq(transcription.organizationId, organizationId),
          ),
        )
        .get();
    },

    async updateStatus(
      id: string,
      data: Partial<
        Pick<
          TranscriptionRow,
          | "status"
          | "fullText"
          | "segments"
          | "language"
          | "durationSeconds"
          | "errorMessage"
          | "retryCount"
          | "startedAt"
          | "completedAt"
          | "model"
        >
      >,
    ): Promise<void> {
      await db.update(transcription).set(data).where(eq(transcription.id, id));
    },

    async deleteByRecordingId(
      recordingId: string,
      organizationId: string,
    ): Promise<void> {
      await db
        .delete(transcription)
        .where(
          and(
            eq(transcription.recordingId, recordingId),
            eq(transcription.organizationId, organizationId),
          ),
        );
    },
  };
}
