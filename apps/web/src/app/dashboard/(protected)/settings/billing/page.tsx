import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { BillingContainer } from "./_containers/billing-container";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function BillingPage({ searchParams }: Props) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader items={[{ label: "設定" }, { label: "課金" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <BillingContainer status={sp.status} />
        </Suspense>
      </div>
    </>
  );
}
