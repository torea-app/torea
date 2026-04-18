"use client";

import { Badge } from "@torea/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@torea/ui/components/ui/table";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from "../../../_lib/types";
import { DeliveryDetailSheet } from "./delivery-detail-sheet";

const STATUS_VARIANT: Record<
  WebhookDeliveryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  in_progress: "secondary",
  success: "default",
  failed: "destructive",
  dead: "destructive",
};

const STATUS_LABEL: Record<WebhookDeliveryStatus, string> = {
  pending: "待機中",
  in_progress: "送信中",
  success: "成功",
  failed: "失敗",
  dead: "停止",
};

type Props = {
  deliveries: WebhookDelivery[];
  endpointId: string;
  errorMessage: string | null;
};

export function DeliveriesTab({ deliveries, endpointId, errorMessage }: Props) {
  const [selected, setSelected] = useState<WebhookDelivery | null>(null);

  if (errorMessage) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
        配信履歴の取得に失敗しました: {errorMessage}
      </div>
    );
  }

  if (deliveries.length === 0) {
    return (
      <p className="rounded-md border p-6 text-center text-muted-foreground text-sm">
        配信履歴はまだありません。「テスト送信」または対象イベントの発生で履歴が作成されます。
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>イベント</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>HTTP</TableHead>
            <TableHead>試行</TableHead>
            <TableHead>所要</TableHead>
            <TableHead>作成日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deliveries.map((d) => (
            <TableRow
              key={d.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => setSelected(d)}
            >
              <TableCell>
                <code className="text-xs">{d.eventName}</code>
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[d.status]}>
                  {STATUS_LABEL[d.status]}
                </Badge>
              </TableCell>
              <TableCell>{d.lastStatusCode ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {d.attemptCount}/{d.maxAttempts}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {d.durationMs !== null ? `${d.durationMs}ms` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDateTime(d.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DeliveryDetailSheet
        delivery={selected}
        onClose={() => setSelected(null)}
        endpointId={endpointId}
      />
    </>
  );
}
