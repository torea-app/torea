import type { PlanId } from "@torea/shared";

/** /pricing 画面で CTA を出し分けるために必要な最小情報。 */
export type CurrentPlanForPricing = {
  plan: PlanId;
};
