import { PLAN_LIMITS, type PlanId } from "@torea/shared";

/**
 * better-auth Stripe plugin に渡す plans 配列を組み立てる。
 *
 * - free は plan 行を持たないため定義に含めない（行が無い = free という解釈）。
 * - 価格 ID は env 経由で受け取る。同じ Price で月額 / 年額 を切り替えられるよう
 *   priceId (= 月額) と annualDiscountPriceId (= 年額) の 2 つを設定する。
 * - limits は plugin が DB に書き込むメタデータだが、本実装では真実源を
 *   PLAN_LIMITS (shared/pricing-config.ts) に統一する。整合のために
 *   plugin の limits にも同じ値を入れておく。
 */
export function buildStripePlans(env: {
  STRIPE_PRICE_ID_PRO_MONTH: string;
  STRIPE_PRICE_ID_PRO_YEAR: string;
}) {
  return [
    {
      name: "pro" satisfies PlanId,
      priceId: env.STRIPE_PRICE_ID_PRO_MONTH,
      annualDiscountPriceId: env.STRIPE_PRICE_ID_PRO_YEAR,
      limits: {
        maxRecordingDurationMs: PLAN_LIMITS.pro.maxRecordingDurationMs,
        monthlyRecordingDurationMs: PLAN_LIMITS.pro.monthlyRecordingDurationMs,
        retentionDays: PLAN_LIMITS.pro.retentionDays ?? -1,
      },
    },
  ];
}
