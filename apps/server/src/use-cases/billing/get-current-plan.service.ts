import type {
  BillingInterval,
  CurrentPlan,
  SubscriptionStatus,
} from "../../domain/types/billing";
import type { SubscriptionRepository } from "../../infrastructure/repositories/subscription.repository";

export type GetCurrentPlanService = ReturnType<
  typeof createGetCurrentPlanService
>;

/**
 * subscription 行の存在を `CurrentPlan` に正規化する。行が無ければ free。
 *
 * 「行はあるが status が `canceled` 等で active でない」ケースは repository 側で
 * 既にフィルタしているため、ここで返ってくる行は必ず有効プラン扱いになる。
 */
export function createGetCurrentPlanService(deps: {
  subscriptionRepo: SubscriptionRepository;
}) {
  return {
    async execute(userId: string): Promise<CurrentPlan> {
      const row = await deps.subscriptionRepo.findActiveByUserId(userId);
      if (!row) {
        return {
          plan: "free",
          status: null,
          periodEnd: null,
          cancelAtPeriodEnd: false,
          billingInterval: null,
        };
      }
      return {
        plan: row.plan === "pro" ? "pro" : "free",
        status: (row.status as SubscriptionStatus | null) ?? null,
        periodEnd: row.periodEnd ?? null,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
        billingInterval:
          (row.billingInterval as BillingInterval | null) ?? null,
      };
    },
  };
}
