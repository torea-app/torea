import type { VideoQuality } from "../types/recording";

/** API_URL の取得は lib/api.ts と統一（VITE_API_URL → 本番フォールバック）。 */
const API_URL = import.meta.env.VITE_API_URL ?? "https://api.torea.app";

export type PlanGuardData = {
  plan: "free" | "pro";
  /** 当該ユーザーがそのプランで録画できる解像度プリセットの集合。 */
  availableQualities: ReadonlyArray<VideoQuality>;
  /** プランの「1 本あたりの最大録画時間」（ミリ秒）。 */
  maxRecordingDurationMs: number;
  /** 月の総録画時間の残量（ミリ秒）。-1 = 無制限。 */
  monthlyRecordingDurationRemainingMs: number;
};

/**
 * GET /api/billing/me を叩いて拡張のクォータ判定に必要な情報だけを抜き出す。
 * 未認証 / fetch 失敗時は `null` を返す。
 */
export async function fetchPlanGuard(): Promise<PlanGuardData | null> {
  try {
    const res = await fetch(`${API_URL}/api/billing/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      plan: "free" | "pro";
      limits: {
        availableQualities: ReadonlyArray<VideoQuality>;
        maxRecordingDurationMs: number;
      };
      usage: { recordingDurationRemainingMs: number };
    };
    return {
      plan: data.plan,
      availableQualities: data.limits.availableQualities,
      maxRecordingDurationMs: data.limits.maxRecordingDurationMs,
      monthlyRecordingDurationRemainingMs:
        data.usage.recordingDurationRemainingMs,
    };
  } catch {
    return null;
  }
}

/**
 * 「実際に録画できる時間」を返す。1 本上限と月の残量の小さい方を採用する。
 * 月の残量が `-1`（Pro 無制限）の場合は 1 本上限を返す。
 */
export function computeEffectiveLimitMs(plan: PlanGuardData): number {
  if (plan.monthlyRecordingDurationRemainingMs < 0) {
    return plan.maxRecordingDurationMs;
  }
  return Math.min(
    plan.maxRecordingDurationMs,
    plan.monthlyRecordingDurationRemainingMs,
  );
}
