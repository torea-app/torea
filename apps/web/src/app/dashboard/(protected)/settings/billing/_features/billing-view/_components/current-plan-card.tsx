import { Badge } from "@torea/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { formatDate } from "@/lib/format";
import type { BillingMe } from "../../../_lib/types";

type Props = {
  data: BillingMe;
};

export function CurrentPlanCard({ data }: Props) {
  const planLabel = data.plan === "pro" ? "Pro" : "Free";
  const intervalLabel =
    data.billingInterval === "year"
      ? "年額"
      : data.billingInterval === "month"
        ? "月額"
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          現在のプラン
          <Badge variant={data.plan === "pro" ? "default" : "secondary"}>
            {planLabel}
          </Badge>
          {intervalLabel ? (
            <Badge variant="outline">{intervalLabel}</Badge>
          ) : null}
          {data.status && data.status !== "active" ? (
            <Badge variant="outline" className="text-amber-600">
              {data.status}
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.periodEnd ? (
          <p className="text-muted-foreground text-sm">
            {data.cancelAtPeriodEnd ? "解約予定日" : "次回更新日"}：
            <span className="ml-1 font-medium text-foreground">
              {formatDate(data.periodEnd)}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            無料プランをご利用中です。Pro
            にアップグレードすると録画時間が無制限になります。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
