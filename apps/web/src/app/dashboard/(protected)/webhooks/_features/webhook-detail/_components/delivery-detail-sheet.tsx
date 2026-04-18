"use client";

import { Badge } from "@torea/ui/components/ui/badge";
import { Button } from "@torea/ui/components/ui/button";
import { ScrollArea } from "@torea/ui/components/ui/scroll-area";
import { Separator } from "@torea/ui/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@torea/ui/components/ui/sheet";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { redeliverWebhookDelivery } from "../../../_lib/actions";
import type {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from "../../../_lib/types";

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
  failed: "失敗 (再試行)",
  dead: "停止 (上限到達)",
};

type Props = {
  delivery: WebhookDelivery | null;
  onClose: () => void;
  endpointId: string;
};

export function DeliveryDetailSheet({ delivery, onClose, endpointId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [redelivered, setRedelivered] = useState(false);

  if (!delivery) return null;

  function handleRedeliver() {
    if (!delivery) return;
    startTransition(async () => {
      const result = await redeliverWebhookDelivery(delivery.id, endpointId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRedelivered(true);
      toast.success("再送信をキューに投入しました");
      router.refresh();
    });
  }

  const payloadPretty = JSON.stringify(delivery.payload, null, 2);

  return (
    <Sheet open={delivery !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>配信詳細</SheetTitle>
          <SheetDescription>
            <code className="text-xs">{delivery.eventName}</code>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-6">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">ステータス</dt>
              <dd>
                <Badge variant={STATUS_VARIANT[delivery.status]}>
                  {STATUS_LABEL[delivery.status]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">試行回数</dt>
              <dd>
                {delivery.attemptCount} / {delivery.maxAttempts}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">作成日時</dt>
              <dd>{formatDateTime(delivery.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">完了日時</dt>
              <dd>
                {delivery.completedAt
                  ? formatDateTime(delivery.completedAt)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">HTTP ステータス</dt>
              <dd>{delivery.lastStatusCode ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">所要時間</dt>
              <dd>
                {delivery.durationMs !== null
                  ? `${delivery.durationMs}ms`
                  : "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground text-xs">
                Event ID (冪等性キー)
              </dt>
              <dd className="font-mono text-xs">{delivery.eventId}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground text-xs">Delivery ID</dt>
              <dd className="font-mono text-xs">{delivery.id}</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          {delivery.lastErrorMessage && (
            <>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">エラー</h4>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-destructive text-xs">
                  {delivery.lastErrorMessage}
                </pre>
              </div>
              <Separator className="my-4" />
            </>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm">レスポンスボディ (先頭 2KB)</h4>
            {delivery.lastResponseBody ? (
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {delivery.lastResponseBody}
              </pre>
            ) : (
              <p className="text-muted-foreground text-xs">(空のレスポンス)</p>
            )}
          </div>

          <Separator className="my-4" />

          <div className="space-y-2 pb-4">
            <h4 className="font-medium text-sm">送信ペイロード (マスク済)</h4>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {payloadPretty}
            </pre>
          </div>
        </ScrollArea>

        <SheetFooter>
          <Button
            onClick={handleRedeliver}
            disabled={pending || redelivered}
            variant="outline"
          >
            <RotateCcwIcon className="mr-1 size-4" />
            {redelivered ? "再送信済み" : "再送信"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
