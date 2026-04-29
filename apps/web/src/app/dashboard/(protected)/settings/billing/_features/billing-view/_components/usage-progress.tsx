import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { Progress } from "@torea/ui/components/ui/progress";
import { formatRecordingMonthlyLimit } from "@/lib/pricing";
import type { BillingMe } from "../../../_lib/types";

type Props = {
  data: BillingMe;
};

export function UsageProgress({ data }: Props) {
  const usedMs = data.usage.recordingDurationUsedMs;
  const limitMs = data.usage.recordingDurationLimitMs;
  const usedMin = Math.round(usedMs / 60_000);

  if (limitMs < 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>今月の録画時間</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="font-bold text-3xl">{usedMin} 分</p>
          <p className="text-muted-foreground text-sm">無制限プラン</p>
        </CardContent>
      </Card>
    );
  }

  const ratio = limitMs === 0 ? 0 : Math.min(100, (usedMs / limitMs) * 100);
  const limitLabel = formatRecordingMonthlyLimit(limitMs);
  const overLimit = ratio >= 100;
  const nearLimit = ratio >= 80 && !overLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>今月の録画時間</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="font-bold text-3xl">
          {usedMin} 分
          <span className="ml-1 font-normal text-base text-muted-foreground">
            / {limitLabel}
          </span>
        </p>
        <Progress value={ratio} />
        {overLimit ? (
          <p className="text-red-600 text-sm">
            上限に達しました。Pro にアップグレードすると無制限になります。
          </p>
        ) : nearLimit ? (
          <p className="text-amber-600 text-sm">
            上限に近づいています。Pro なら無制限です。
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
