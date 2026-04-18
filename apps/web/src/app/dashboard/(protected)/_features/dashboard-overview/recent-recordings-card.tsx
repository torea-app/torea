import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { ArrowRightIcon, VideoIcon } from "lucide-react";
import Link from "next/link";
import {
  formatDuration,
  formatRelativeTime,
} from "../../recordings/_lib/format";
import { getRecordings } from "../../recordings/_lib/queries";

const RECENT_LIMIT = 5;

/**
 * 直近の録画 5 件をプレビュー表示するカード。
 * ダッシュボードから録画詳細 / 録画一覧への導線を兼ねる。
 * 取得に失敗した場合や 0 件の場合は null を返し、UI に何も出さない。
 */
export async function RecentRecordingsCard() {
  const result = await getRecordings({ limit: RECENT_LIMIT, offset: 0 });

  if (!result.success || result.data.recordings.length === 0) {
    return null;
  }

  const { recordings } = result.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近の録画</CardTitle>
        <CardDescription>直近 {recordings.length} 件</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href="/dashboard/recordings"
                aria-label="録画一覧ページへ"
              />
            }
          >
            すべて見る
            <ArrowRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {recordings.map((rec) => (
            <li key={rec.id}>
              <Link
                href={`/dashboard/recordings/${rec.id}`}
                className="flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-muted/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <VideoIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{rec.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatRelativeTime(rec.createdAt)} ・{" "}
                    {formatDuration(rec.durationMs)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
