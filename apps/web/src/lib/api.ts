import { env } from "@torea/env/web";
import { hcWithType } from "@torea/server/hc";
import { openUpgradeCtaDialog } from "@/lib/upgrade-cta-store";

/**
 * 402 Payment Required レスポンスから error code を読み取り、
 * 対応する Upgrade CTA ダイアログを表示する。
 *
 * - PLAN_QUOTA_EXCEEDED → 月間総時間 / 単一録画上限
 * - PLAN_REQUIRED → 4K 画質 / Drive 自動保存 / 視聴分析
 *
 * Body は別の caller も読めるように `clone()` を経由して読む（response の
 * body を二重に消費しない）。
 */
async function handlePaymentRequired(res: Response): Promise<void> {
  if (res.status !== 402) return;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as {
    code?: string;
    reason?: string;
    required?: string;
  } | null;

  if (body?.code === "PLAN_QUOTA_EXCEEDED") {
    openUpgradeCtaDialog({
      source:
        body.reason === "single_recording_too_long"
          ? "single_recording_too_long"
          : "quota_exceeded",
    });
  } else if (body?.code === "PLAN_REQUIRED") {
    // PLAN_REQUIRED は文脈依存（4K / Drive など）。reason フィールドは現状
    // billing.error には無いため、デフォルトは quality_locked_ultra にしておく。
    // 呼び出し側でより正確な source を指定したい場合は、handler で 402 を
    // キャッチした上で個別に openUpgradeCtaDialog を呼ぶ。
    openUpgradeCtaDialog({ source: "quality_locked_ultra" });
  }
}

export const api = hcWithType(env.NEXT_PUBLIC_SERVER_URL, {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, {
      credentials: "include",
      cache: "no-store",
      ...init,
    });
    await handlePaymentRequired(res);
    return res;
  },
});
