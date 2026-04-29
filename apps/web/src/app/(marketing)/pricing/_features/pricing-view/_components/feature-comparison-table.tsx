import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@torea/ui/components/ui/table";
import {
  formatPriceJpy,
  formatRecordingMaxLength,
  formatRecordingMonthlyLimit,
  formatRetention,
  formatStorage,
  PLAN_LIMITS,
  PLAN_PRICES_JPY,
} from "@/lib/pricing";

type Props = {
  interval: "month" | "year";
};

export function FeatureComparisonTable({ interval }: Props) {
  const free = PLAN_LIMITS.free;
  const pro = PLAN_LIMITS.pro;
  const proPrice = PLAN_PRICES_JPY.pro[interval];

  const rows: Array<{ label: string; free: string; pro: string }> = [
    {
      label: "料金",
      free: "¥0",
      pro: formatPriceJpy(proPrice, interval === "year" ? "/ 年" : "/ 月"),
    },
    {
      label: "1 本あたりの録画時間",
      free: formatRecordingMaxLength(free.maxRecordingDurationMs),
      pro: formatRecordingMaxLength(pro.maxRecordingDurationMs),
    },
    {
      label: "月の総録画時間",
      free: formatRecordingMonthlyLimit(free.monthlyRecordingDurationMs),
      pro: formatRecordingMonthlyLimit(pro.monthlyRecordingDurationMs),
    },
    {
      label: "録画の保持期間",
      free: formatRetention(free.retentionDays),
      pro: formatRetention(pro.retentionDays),
    },
    {
      label: "ストレージ",
      free: formatStorage(free.storageGb),
      pro: formatStorage(pro.storageGb),
    },
    {
      label: "録画解像度",
      free: free.availableQualities.includes("ultra")
        ? "4K まで"
        : "1080p まで",
      pro: pro.availableQualities.includes("ultra") ? "4K まで" : "1080p まで",
    },
    {
      label: "Google Drive 自動保存",
      free: free.driveAutoSaveAllowed ? "あり" : "手動のみ",
      pro: pro.driveAutoSaveAllowed ? "あり" : "手動のみ",
    },
    {
      label: "文字起こし",
      free: "あり",
      pro: "あり",
    },
    {
      label: "共有リンク",
      free: "あり",
      pro: "あり",
    },
    {
      label: "Webhook",
      free: "あり",
      pro: "あり",
    },
  ];

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-2/5">機能</TableHead>
            <TableHead className="w-3/10">Free</TableHead>
            <TableHead className="w-3/10">Pro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.free}
              </TableCell>
              <TableCell>{row.pro}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
