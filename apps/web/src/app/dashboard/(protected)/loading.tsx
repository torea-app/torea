import { PageHeader } from "@/components/page-header";
import { DashboardOverviewLoading } from "./_features/dashboard-overview/loading";

export default function Loading() {
  return (
    <>
      <PageHeader items={[{ label: "ダッシュボード" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <DashboardOverviewLoading />
      </div>
    </>
  );
}
