// NOTE: dep-cruiser ルール `domain-no-external-packages` のため、
// `@torea/shared` を import せずにリテラル型を再掲する。
// `@torea/shared` の `PlanId` / `BillingInterval` と意味的に等価でなければならない。

export type PlanId = "free" | "pro";
export type BillingInterval = "month" | "year";

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type CurrentPlan = {
  plan: PlanId;
  /** free のときは null。 */
  status: SubscriptionStatus | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  billingInterval: BillingInterval | null;
};

export type UsageSnapshot = {
  periodStart: Date;
  plan: PlanId;
  /** 経過時間（ミリ秒）。表示時は ms / 60_000 で「分」に変換する。 */
  recordingDurationUsedMs: number;
  recordingCount: number;
};
