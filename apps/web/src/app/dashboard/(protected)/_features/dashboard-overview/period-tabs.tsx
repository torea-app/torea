"use client";

import { Tabs, TabsList, TabsTrigger } from "@torea/ui/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useTransition } from "react";
import {
  DASHBOARD_PERIODS,
  type DashboardPeriod,
  DEFAULT_PERIOD,
  PERIOD_LABELS,
} from "../../_lib/period";

type Props = {
  value: DashboardPeriod;
};

export function PeriodTabs({ value }: Props) {
  const [isPending, startTransition] = useTransition();
  const [, setPeriod] = useQueryState(
    "period",
    parseAsStringLiteral(DASHBOARD_PERIODS)
      .withDefault(DEFAULT_PERIOD)
      .withOptions({ startTransition, shallow: false }),
  );

  return (
    <Tabs
      value={value}
      onValueChange={(v) => setPeriod(v as DashboardPeriod)}
      aria-label="集計期間"
    >
      <TabsList data-pending={isPending ? "" : undefined}>
        {DASHBOARD_PERIODS.map((p) => (
          <TabsTrigger key={p} value={p}>
            {PERIOD_LABELS[p]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
