"use client";

import { Alert, AlertDescription } from "@torea/ui/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@torea/ui/components/ui/alert-dialog";
import { Badge } from "@torea/ui/components/ui/badge";
import { Button } from "@torea/ui/components/ui/button";
import { Label } from "@torea/ui/components/ui/label";
import { Separator } from "@torea/ui/components/ui/separator";
import { Switch } from "@torea/ui/components/ui/switch";
import {
  AlertTriangleIcon,
  RefreshCwIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import {
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  sendTestWebhook,
  updateWebhookEndpoint,
} from "../../../_lib/actions";
import type {
  WebhookEndpoint,
  WebhookEndpointStatus,
} from "../../../_lib/types";
import { SecretRevealedDialog } from "../../webhooks-list/_components/secret-revealed-dialog";
import { EditForm } from "./edit-form";

const STATUS_CONFIG: Record<
  WebhookEndpointStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  disabled: { label: "自動無効化", variant: "destructive" },
};

export function OverviewTab({ endpoint }: { endpoint: WebhookEndpoint }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);

  const status = STATUS_CONFIG[endpoint.status];
  const isActive = endpoint.status === "active";
  const isToggleable =
    endpoint.status === "active" || endpoint.status === "paused";

  function handleToggleStatus(checked: boolean) {
    startTransition(async () => {
      const result = await updateWebhookEndpoint(endpoint.id, {
        status: checked ? "active" : "paused",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        checked ? "Webhook を有効化しました" : "Webhook を一時停止しました",
      );
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      const result = await updateWebhookEndpoint(endpoint.id, {
        status: "active",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // 復帰直後にテスト送信を自動実行して URL の到達性を即座に確認する
      const testResult = await sendTestWebhook(endpoint.id);
      if (testResult.success) {
        toast.success(
          "Webhook を再開しました。テスト送信を投入したので配信履歴で結果を確認してください。",
        );
      } else {
        toast.success("Webhook を再開しました");
        toast.error(`自動テスト送信に失敗: ${testResult.error}`);
      }
      router.refresh();
    });
  }

  function handleRotate() {
    startTransition(async () => {
      const result = await rotateWebhookSecret(endpoint.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRotatedSecret(result.data.secret);
      setIsRotateDialogOpen(false);
    });
  }

  async function handleTest() {
    const result = await sendTestWebhook(endpoint.id);
    if (result.success) {
      toast.success("テスト送信をキューに投入しました");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleDelete() {
    if (
      !confirm(
        `「${endpoint.name}」を削除しますか？関連する配信履歴も全て削除され、この操作は取り消せません。`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteWebhookEndpoint(endpoint.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Webhook を削除しました");
      router.push("/dashboard/webhooks");
    });
  }

  return (
    <div className="space-y-6">
      {endpoint.status === "disabled" && (
        <Alert variant="destructive">
          <AlertTriangleIcon className="size-4" />
          <AlertDescription>
            このエンドポイントは連続失敗により自動的に無効化されました (
            {endpoint.consecutiveFailures} 回連続失敗)。 URL
            を確認してから「再開」してください。
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{endpoint.name}</h3>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p
              className="break-all text-muted-foreground text-xs"
              title={endpoint.url}
            >
              {endpoint.url}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isToggleable && (
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="webhook-active-toggle"
                  checked={isActive}
                  onCheckedChange={handleToggleStatus}
                  disabled={pending}
                />
                <Label htmlFor="webhook-active-toggle" className="font-normal">
                  {isActive ? "有効" : "一時停止"}
                </Label>
              </div>
            )}
            {endpoint.status === "disabled" && (
              <Button onClick={handleResume} disabled={pending} size="sm">
                再開
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">シークレット</dt>
            <dd className="font-mono">{endpoint.secretPrefix}…</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">連続失敗</dt>
            <dd>{endpoint.consecutiveFailures} 回</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">最終成功</dt>
            <dd>
              {endpoint.lastSuccessAt
                ? formatDateTime(endpoint.lastSuccessAt)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">最終失敗</dt>
            <dd>
              {endpoint.lastFailureAt
                ? formatDateTime(endpoint.lastFailureAt)
                : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={pending}
          >
            <SendIcon className="mr-1 size-4" />
            テスト送信
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRotateDialogOpen(true)}
            disabled={pending}
          >
            <RefreshCwIcon className="mr-1 size-4" />
            シークレット再生成
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={pending}
          >
            <TrashIcon className="mr-1 size-4" />
            削除
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-4 font-semibold text-base">設定を編集</h3>
        <EditForm endpoint={endpoint} />
      </div>

      <AlertDialog
        open={isRotateDialogOpen}
        onOpenChange={setIsRotateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>シークレットを再生成しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              古いシークレットは即座に無効になります。既存の連携先で利用している場合は、新しいシークレットに差し替える必要があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRotate();
              }}
              disabled={pending}
            >
              再生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rotatedSecret && (
        <SecretRevealedDialog
          open={rotatedSecret !== null}
          onClose={() => {
            setRotatedSecret(null);
            router.refresh();
          }}
          secret={rotatedSecret}
          title="シークレットを再生成しました"
          description="新しい署名シークレットはこの画面でのみ表示されます。古いシークレットは即座に無効になりました。"
        />
      )}
    </div>
  );
}
