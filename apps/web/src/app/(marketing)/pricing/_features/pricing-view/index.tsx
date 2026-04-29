"use client";

import { useState } from "react";
import { type BillingInterval, PLAN_PRICES_JPY } from "@/lib/pricing";
import type { CurrentPlanForPricing } from "../../_lib/types";
import { BillingIntervalToggle } from "./_components/billing-interval-toggle";
import { FeatureComparisonTable } from "./_components/feature-comparison-table";
import { PlanCard } from "./_components/plan-card";

type Props = {
  currentPlan: CurrentPlanForPricing | null;
};

export function PricingView({ currentPlan }: Props) {
  // 年額がデフォルト（plan §6 のアクセシビリティ要件）。
  const [interval, setInterval] = useState<BillingInterval>("year");

  return (
    <div className="space-y-12">
      <header className="text-center">
        <h1 className="font-bold text-4xl">シンプルな 2 プラン</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          無料で始めて、必要になったら Pro へ。
        </p>
      </header>

      <BillingIntervalToggle value={interval} onChange={setInterval} />

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
        <PlanCard plan="free" currentPlan={currentPlan?.plan ?? null} />
        <PlanCard
          plan="pro"
          currentPlan={currentPlan?.plan ?? null}
          interval={interval}
          priceJpy={PLAN_PRICES_JPY.pro[interval]}
        />
      </div>

      <section>
        <h2 className="mb-6 font-semibold text-2xl">プラン比較</h2>
        <FeatureComparisonTable interval={interval} />
      </section>
    </div>
  );
}
