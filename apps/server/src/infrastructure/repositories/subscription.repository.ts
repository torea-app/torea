import { subscription } from "@torea/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const ACTIVE_STATUSES = ["active", "trialing"] as const;

export type SubscriptionRow = typeof subscription.$inferSelect;
export type SubscriptionRepository = ReturnType<
  typeof createSubscriptionRepository
>;

/**
 * better-auth/stripe plugin が独占的に書き込む subscription テーブルの
 * 読み取り専用アクセス。書き込みヘルパは意図的に提供しない（plugin に任せる）。
 */
export function createSubscriptionRepository(d1: D1Database) {
  const db = drizzle(d1);

  return {
    async findActiveByUserId(
      userId: string,
    ): Promise<SubscriptionRow | undefined> {
      const rows = await db
        .select()
        .from(subscription)
        .where(
          and(
            eq(subscription.referenceId, userId),
            inArray(subscription.status, [...ACTIVE_STATUSES]),
          ),
        )
        .orderBy(desc(subscription.periodEnd))
        .limit(1);
      return rows[0];
    },
  };
}
