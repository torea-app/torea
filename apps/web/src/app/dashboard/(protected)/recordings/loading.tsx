import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";

export default function RecordingsLoading() {
  return (
    <>
      <PageHeader items={[{ label: "録画" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <LoadingSkeleton />
      </div>
    </>
  );
}
