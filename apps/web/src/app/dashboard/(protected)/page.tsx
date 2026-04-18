import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardOverviewContainer } from "./_containers/dashboard-overview-container";
import { DashboardOverviewLoading } from "./_features/dashboard-overview/loading";
import { loadDashboardSearchParams } from "./_lib/search-params";

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const { period } = await loadDashboardSearchParams(searchParams);

  return (
    <>
      <PageHeader items={[{ label: "ダッシュボード" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense key={period} fallback={<DashboardOverviewLoading />}>
          <DashboardOverviewContainer period={period} />
        </Suspense>
      </div>
    </>
  );
}
