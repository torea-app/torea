import { Skeleton } from "@torea/ui/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";

export default function RecordingDetailLoading() {
  return (
    <>
      <PageHeader
        items={[
          { label: "録画", href: "/dashboard/recordings" },
          { label: "再生" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* ビデオプレーヤー プレースホルダー */}
        <Skeleton className="aspect-video w-full rounded-lg" />
        {/* メタデータ プレースホルダー */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </>
  );
}
