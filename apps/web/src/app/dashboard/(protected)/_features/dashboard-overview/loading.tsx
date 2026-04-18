import { Skeleton } from "@torea/ui/components/ui/skeleton";

const SKELETON_KEYS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;

export function DashboardOverviewLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} className="h-[108px] w-full" />
        ))}
      </div>
    </div>
  );
}
