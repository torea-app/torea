import { AlertTriangleIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { DashboardOverview } from "../_features/dashboard-overview";
import { getDashboardOverview } from "../_lib/analytics-queries";
import type { DashboardPeriod } from "../_lib/period";

type Props = {
  period: DashboardPeriod;
};

export async function DashboardOverviewContainer({ period }: Props) {
  const result = await getDashboardOverview({ period });

  if (!result.success) {
    return (
      <EmptyState
        icon={<AlertTriangleIcon className="size-12" />}
        title="データの取得に失敗しました"
        description={result.error}
      />
    );
  }

  return <DashboardOverview overview={result.data} period={period} />;
}
