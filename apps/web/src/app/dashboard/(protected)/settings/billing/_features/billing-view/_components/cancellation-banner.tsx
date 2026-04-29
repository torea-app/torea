import { AlertTriangleIcon } from "lucide-react";
import { formatDate } from "@/lib/format";

type Props = {
  periodEnd: string | null;
};

export function CancellationBanner({ periodEnd }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold text-sm">解約予定です</p>
        <p className="text-sm">
          {periodEnd ? (
            <>
              現在の Pro 機能は{" "}
              <span className="font-medium">{formatDate(periodEnd)}</span>{" "}
              まで利用できます。それ以降は Free プランに戻ります。
            </>
          ) : (
            <>
              Pro の解約予約が入っています。期間終了後は Free プランに戻ります。
            </>
          )}
        </p>
        <p className="text-amber-800 text-xs dark:text-amber-300">
          解約をキャンセルしたい場合は、下の「お支払い方法・請求書を管理」から取り消せます。
        </p>
      </div>
    </div>
  );
}
