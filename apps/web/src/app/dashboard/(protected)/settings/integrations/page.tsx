import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { IntegrationsContainer } from "./_containers/integrations-container";

type Props = {
  searchParams: Promise<{ status?: string; reason?: string }>;
};

export default async function IntegrationsPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader items={[{ label: "設定" }, { label: "連携" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <IntegrationsContainer status={sp.status} reason={sp.reason} />
        </Suspense>
      </div>
    </>
  );
}
