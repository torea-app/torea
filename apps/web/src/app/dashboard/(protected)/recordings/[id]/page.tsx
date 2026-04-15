import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { RecordingDetailContainer } from "./_containers/recording-detail-container";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RecordingDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        items={[
          { label: "録画", href: "/dashboard/recordings" },
          { label: "再生" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <RecordingDetailContainer recordingId={id} />
        </Suspense>
      </div>
    </>
  );
}
