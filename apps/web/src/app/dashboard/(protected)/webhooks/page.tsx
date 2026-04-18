import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { WebhooksListContainer } from "./_containers/webhooks-list-container";

export default function WebhooksPage() {
  return (
    <>
      <PageHeader items={[{ label: "設定" }, { label: "Webhook" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <WebhooksListContainer />
        </Suspense>
      </div>
    </>
  );
}
