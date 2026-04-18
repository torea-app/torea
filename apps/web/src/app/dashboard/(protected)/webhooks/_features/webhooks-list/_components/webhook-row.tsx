"use client";

import { Badge } from "@torea/ui/components/ui/badge";
import { Button } from "@torea/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@torea/ui/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@torea/ui/components/ui/table";
import {
  ExternalLinkIcon,
  MoreHorizontalIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { deleteWebhookEndpoint, sendTestWebhook } from "../../../_lib/actions";
import type {
  WebhookEndpoint,
  WebhookEndpointStatus,
} from "../../../_lib/types";

const STATUS_CONFIG: Record<
  WebhookEndpointStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  disabled: { label: "自動無効化", variant: "destructive" },
};

type Props = {
  endpoint: WebhookEndpoint;
  onDeleted: () => void;
};

export function WebhookRow({ endpoint, onDeleted }: Props) {
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const status = STATUS_CONFIG[endpoint.status];

  function handleDelete() {
    if (
      !confirm(`「${endpoint.name}」を削除しますか？この操作は取り消せません。`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteWebhookEndpoint(endpoint.id);
      if (result.success) {
        toast.success("Webhook を削除しました");
        onDeleted();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleTest() {
    setTesting(true);
    const result = await sendTestWebhook(endpoint.id);
    setTesting(false);
    if (result.success) {
      toast.success(
        "テスト送信をキューに投入しました。配信履歴で結果を確認できます。",
      );
    } else {
      toast.error(result.error);
    }
  }

  const lastDelivery = endpoint.lastSuccessAt ?? endpoint.lastFailureAt;

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <Link
          href={`/dashboard/webhooks/${endpoint.id}`}
          className="block truncate font-medium hover:underline"
          title={endpoint.name}
        >
          {endpoint.name}
        </Link>
        <span
          className="block truncate text-muted-foreground text-xs"
          title={endpoint.url}
        >
          {endpoint.url}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{endpoint.events.length} 件</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {lastDelivery ? formatDateTime(lastDelivery) : "—"}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={pending || testing}
              />
            }
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">操作メニュー</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              render={<Link href={`/dashboard/webhooks/${endpoint.id}`} />}
            >
              <ExternalLinkIcon className="mr-2 size-4" />
              詳細
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleTest} disabled={testing}>
              <SendIcon className="mr-2 size-4" />
              テスト送信
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <TrashIcon className="mr-2 size-4" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
