import { getCurrentPeriodStart, PLAN_LIMITS } from "@torea/shared";
import { QuotaExceededError } from "../../domain/errors/billing.error";
import type { CurrentPlan } from "../../domain/types/billing";
import type { UsageQuotaRepository } from "../../infrastructure/repositories/usage-quota.repository";

export type CheckRecordingQuotaService = ReturnType<
  typeof createCheckRecordingQuotaService
>;

/**
 * 録画開始時の月間総時間判定 / 完了時の単一録画時間判定。
 *
 * `beforeStart` は `usage_quota` を遅延作成した上で、月間上限に達していれば
 * QuotaExceededError("monthly_total") を投げる。Pro は monthlyRecordingDurationMs = -1
 * で無制限を示す。
 *
 * `afterComplete` は録画完了時に拡張側のガード（30 分でストップ等）を迂回した
 * 不正な durationMs を弾く防御線。
 */
export function createCheckRecordingQuotaService(deps: {
  quotaRepo: UsageQuotaRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return {
    async beforeStart(args: {
      userId: string;
      currentPlan: CurrentPlan;
    }): Promise<{ periodStart: Date }> {
      const limits = PLAN_LIMITS[args.currentPlan.plan];
      const periodStart = getCurrentPeriodStart(now());

      const quota = await deps.quotaRepo.ensurePeriod({
        userId: args.userId,
        periodStart,
        plan: args.currentPlan.plan,
      });

      if (limits.monthlyRecordingDurationMs >= 0) {
        const usedMs = quota.recordingMinutesUsedX1000 * 60;
        if (usedMs >= limits.monthlyRecordingDurationMs) {
          throw new QuotaExceededError(
            "monthly_total",
            "今月の録画時間の上限に達しました。Pro にアップグレードすると無制限になります。",
          );
        }
      }
      return { periodStart };
    },

    afterComplete(args: {
      currentPlan: CurrentPlan;
      durationMs: number;
    }): void {
      const limits = PLAN_LIMITS[args.currentPlan.plan];
      if (args.durationMs > limits.maxRecordingDurationMs) {
        throw new QuotaExceededError(
          "single_recording_too_long",
          `1 本あたりの録画時間上限（${limits.maxRecordingDurationMs / 60_000} 分）を超えています。`,
        );
      }
    },
  };
}
