import { userIntegrationPreference } from "@torea/db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export type UserIntegrationPreferenceRow =
  typeof userIntegrationPreference.$inferSelect;

export type UserIntegrationPreferenceRepository = ReturnType<
  typeof createUserIntegrationPreferenceRepository
>;

export function createUserIntegrationPreferenceRepository(d1: D1Database) {
  const db = drizzle(d1);
  return {
    async findByUserId(
      userId: string,
    ): Promise<UserIntegrationPreferenceRow | undefined> {
      return db
        .select()
        .from(userIntegrationPreference)
        .where(eq(userIntegrationPreference.userId, userId))
        .get();
    },

    async upsertAutoSave(userId: string, autoSave: boolean): Promise<void> {
      await db
        .insert(userIntegrationPreference)
        .values({ userId, autoSaveToDrive: autoSave })
        .onConflictDoUpdate({
          target: userIntegrationPreference.userId,
          set: { autoSaveToDrive: autoSave },
        });
    },
  };
}
