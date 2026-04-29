import { getCurrentPeriodStart } from "@torea/shared";
import type { UsageQuotaRepository } from "../../infrastructure/repositories/usage-quota.repository";

export type RecordRecordingUsageService = ReturnType<
  typeof createRecordRecordingUsageService
>;

/**
 * 録画完了時の使用量加算。月をまたぐ録画は完了時刻の月に丸める
 * （境界の 1 件は許容範囲とする）。
 */
export function createRecordRecordingUsageService(deps: {
  quotaRepo: UsageQuotaRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return {
    async execute(args: { userId: string; durationMs: number }): Promise<void> {
      await deps.quotaRepo.addRecordingUsage({
        userId: args.userId,
        periodStart: getCurrentPeriodStart(now()),
        durationMs: args.durationMs,
      });
    },
  };
}
