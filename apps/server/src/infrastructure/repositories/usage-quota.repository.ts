import { usageQuota } from "@torea/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { PlanId } from "../../domain/types/billing";

export type UsageQuotaRow = typeof usageQuota.$inferSelect;
export type UsageQuotaRepository = ReturnType<
  typeof createUsageQuotaRepository
>;

/**
 * 月次クオータの read / increment 専用リポジトリ。
 *
 * `ensurePeriod` は `INSERT OR IGNORE` を使い、同時並列の挿入が unique index で
 * 1 行に収束するよう設計している（race-safe）。
 *
 * `addRecordingUsage` は `UPDATE ... SET x = x + ?` を Drizzle の `sql` テンプレートで
 * 組み、read-modify-write を回避している。
 */
export function createUsageQuotaRepository(
  d1: D1Database,
  generateId: () => string,
) {
  const db = drizzle(d1);

  return {
    async ensurePeriod(args: {
      userId: string;
      periodStart: Date;
      plan: PlanId;
    }): Promise<UsageQuotaRow> {
      await db
        .insert(usageQuota)
        .values({
          id: generateId(),
          userId: args.userId,
          periodStart: args.periodStart,
          plan: args.plan,
        })
        .onConflictDoNothing({
          target: [usageQuota.userId, usageQuota.periodStart],
        });

      const rows = await db
        .select()
        .from(usageQuota)
        .where(
          and(
            eq(usageQuota.userId, args.userId),
            eq(usageQuota.periodStart, args.periodStart),
          ),
        )
        .limit(1);
      // INSERT OR IGNORE 直後 + UNIQUE INDEX のため、ここで undefined にはならない。
      // biome-ignore lint/style/noNonNullAssertion: invariant from ON CONFLICT DO NOTHING + unique index
      return rows[0]!;
    },

    async addRecordingUsage(args: {
      userId: string;
      periodStart: Date;
      durationMs: number;
    }): Promise<void> {
      // 単位は「ミリ分」 = ms / 60。例: 30 分 = 1_800_000 ms = 30_000 ミリ分。
      const minutesUsedX1000 = Math.floor(args.durationMs / 60);
      await db
        .update(usageQuota)
        .set({
          recordingMinutesUsedX1000: sql`${usageQuota.recordingMinutesUsedX1000} + ${minutesUsedX1000}`,
          recordingCount: sql`${usageQuota.recordingCount} + 1`,
        })
        .where(
          and(
            eq(usageQuota.userId, args.userId),
            eq(usageQuota.periodStart, args.periodStart),
          ),
        );
    },
  };
}
