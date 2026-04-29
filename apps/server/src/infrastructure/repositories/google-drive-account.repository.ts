import { googleDriveAccount } from "@torea/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type GoogleDriveAccountRow = typeof googleDriveAccount.$inferSelect;
export type GoogleDriveAccountInsert = typeof googleDriveAccount.$inferInsert;

export type GoogleDriveAccountRepository = ReturnType<
  typeof createGoogleDriveAccountRepository
>;

export function createGoogleDriveAccountRepository(d1: D1Database) {
  const db = drizzle(d1);
  return {
    async findByUserId(
      userId: string,
    ): Promise<GoogleDriveAccountRow | undefined> {
      return db
        .select()
        .from(googleDriveAccount)
        .where(eq(googleDriveAccount.userId, userId))
        .get();
    },

    async upsert(
      data: GoogleDriveAccountInsert,
    ): Promise<GoogleDriveAccountRow> {
      const rows = await db
        .insert(googleDriveAccount)
        .values(data)
        .onConflictDoUpdate({
          target: googleDriveAccount.userId,
          set: {
            googleSubject: data.googleSubject,
            googleEmail: data.googleEmail,
            accessTokenEncrypted: data.accessTokenEncrypted,
            refreshTokenEncrypted: data.refreshTokenEncrypted,
            scope: data.scope,
            accessTokenExpiresAt: data.accessTokenExpiresAt,
            status: "active",
          },
        })
        .returning();
      // biome-ignore lint/style/noNonNullAssertion: INSERT ... RETURNING always returns a row
      return rows[0]!;
    },

    async updateTokens(params: {
      userId: string;
      accessTokenEncrypted: string;
      accessTokenExpiresAt: Date;
      refreshTokenEncrypted?: string;
    }): Promise<void> {
      await db
        .update(googleDriveAccount)
        .set({
          accessTokenEncrypted: params.accessTokenEncrypted,
          accessTokenExpiresAt: params.accessTokenExpiresAt,
          ...(params.refreshTokenEncrypted
            ? { refreshTokenEncrypted: params.refreshTokenEncrypted }
            : {}),
        })
        .where(eq(googleDriveAccount.userId, params.userId));
    },

    async markRevoked(userId: string): Promise<void> {
      await db
        .update(googleDriveAccount)
        .set({ status: "revoked" })
        .where(eq(googleDriveAccount.userId, userId));
    },

    async setRootFolderId(userId: string, folderId: string): Promise<void> {
      await db
        .update(googleDriveAccount)
        .set({ rootFolderId: folderId })
        .where(eq(googleDriveAccount.userId, userId));
    },

    async delete(userId: string): Promise<void> {
      await db
        .delete(googleDriveAccount)
        .where(eq(googleDriveAccount.userId, userId));
    },
  };
}
