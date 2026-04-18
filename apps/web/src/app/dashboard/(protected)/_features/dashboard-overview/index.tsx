import {
  FileVideoIcon,
  HardDriveIcon,
  MessageSquareIcon,
  PlayCircleIcon,
  TimerIcon,
  UsersIcon,
} from "lucide-react";
import type { DashboardOverviewResponse } from "../../_lib/analytics-types";
import {
  formatCount,
  formatTotalBytes,
  formatTotalDuration,
} from "../../_lib/format";
import type { DashboardPeriod } from "../../_lib/period";
import { OnboardingEmptyState } from "./empty-state-onboarding";
import { MetricCard } from "./metric-card";
import { PeriodTabs } from "./period-tabs";
import { RecentRecordingsCard } from "./recent-recordings-card";

type Props = {
  overview: DashboardOverviewResponse;
  period: DashboardPeriod;
};

export function DashboardOverview({ overview, period }: Props) {
  const { recording, viewing, commenting } = overview;

  const isBrandNew = recording.count === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-semibold text-lg">概要</h1>
        <PeriodTabs value={period} />
      </div>

      <section
        aria-label="ダッシュボード指標"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <MetricCard
          icon={<FileVideoIcon className="size-4" />}
          label="録画数"
          value={formatCount(recording.count)}
          hint="期間内に作成された録画の件数"
        />
        <MetricCard
          icon={<TimerIcon className="size-4" />}
          label="録画時間合計"
          value={formatTotalDuration(recording.totalDurationMs)}
          hint="完了 / 処理中の録画の長さを合算"
        />
        <MetricCard
          icon={<HardDriveIcon className="size-4" />}
          label="容量合計"
          value={formatTotalBytes(recording.totalFileSize)}
          hint="完了 / 処理中の録画ファイルの合計容量"
        />
        <MetricCard
          icon={<PlayCircleIcon className="size-4" />}
          label="視聴数"
          value={formatCount(viewing.totalViews)}
          hint="共有リンク経由を含むすべての再生イベント"
        />
        <MetricCard
          icon={<UsersIcon className="size-4" />}
          label="ユニーク視聴者"
          value={formatCount(viewing.uniqueViewers)}
          hint="同一ユーザー / 匿名ブラウザを 1 人としてカウント"
        />
        <MetricCard
          icon={<MessageSquareIcon className="size-4" />}
          label="コメント数"
          value={formatCount(commenting.count)}
          hint="期間内に投稿されたコメント数"
        />
      </section>

      {isBrandNew ? <OnboardingEmptyState /> : <RecentRecordingsCard />}
    </div>
  );
}
