import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { RecordingsContainer } from "./_containers/recordings-container";
import { loadRecordingsSearchParams } from "./_lib/search-params";

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function RecordingsPage({ searchParams }: Props) {
  const { offset } = await loadRecordingsSearchParams(searchParams);

  return (
    <>
      <PageHeader items={[{ label: "録画" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <RecordingsContainer offset={offset} />
        </Suspense>
      </div>
    </>
  );
}
