"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@torea/ui/components/ui/table";
import { WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import type { WebhookEndpoint } from "../../_lib/types";
import { NewWebhookDialog } from "./_components/new-webhook-dialog";
import { WebhookRow } from "./_components/webhook-row";

type Props = {
  endpoints: WebhookEndpoint[];
  total: number;
};

export function WebhooksListView({ endpoints }: Props) {
  const router = useRouter();
  const isEmpty = endpoints.length === 0;

  // NewWebhookDialog は常に同じ位置で単一マウントする。
  // (empty → 非 empty の遷移で再マウントすると、作成直後の
  //  SecretRevealedDialog に渡す revealedSecret state が失われるため)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Webhook</h2>
          <p className="text-muted-foreground text-sm">
            外部サービスにイベントを HMAC-SHA256 署名付きで配信します。
          </p>
        </div>
        <NewWebhookDialog />
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<WebhookIcon className="size-12" />}
          title="まだ Webhook は登録されていません"
          description="録画完了・文字起こし完了などのイベントを、外部サーバーや Zapier に自動送信できます。"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">名前 / URL</TableHead>
              <TableHead>イベント</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>最終配信</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.map((endpoint) => (
              <WebhookRow
                key={endpoint.id}
                endpoint={endpoint}
                onDeleted={() => router.refresh()}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
