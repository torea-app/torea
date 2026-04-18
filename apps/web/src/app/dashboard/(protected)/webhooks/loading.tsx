import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";

export default function Loading() {
  return (
    <>
      <PageHeader items={[{ label: "設定" }, { label: "Webhook" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <LoadingSkeleton />
      </div>
    </>
  );
}
