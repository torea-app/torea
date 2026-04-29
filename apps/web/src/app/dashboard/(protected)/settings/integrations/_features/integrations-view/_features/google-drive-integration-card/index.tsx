"use client";

import { env } from "@torea/env/web";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@torea/ui/components/ui/alert-dialog";
import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { Label } from "@torea/ui/components/ui/label";
import { Switch } from "@torea/ui/components/ui/switch";
import { AlertTriangleIcon, CheckCircle2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { openUpgradeCtaDialog } from "@/lib/upgrade-cta-store";
import { useCurrentPlan } from "@/lib/use-current-plan";
import type { GoogleDriveIntegrationStatus } from "../../../../_lib/types";

type Props = {
  initialIntegration: GoogleDriveIntegrationStatus;
  initialAutoSave: boolean;
  callbackStatus?: string;
  callbackReason?: string;
};

const REASON_MESSAGES: Record<string, string> = {
  missing_params:
    "不明なエラー (パラメータ不足) が発生しました。もう一度お試しください。",
  invalid_state: "セキュリティ検証に失敗しました。もう一度お試しください。",
  token_exchange_failed:
    "Google との接続に失敗しました。時間を置いて再試行してください。",
  access_denied: "同意がキャンセルされました。",
  drive_scope_missing:
    "Drive ファイルへのアクセス権限が許可されませんでした。再連携時に「Google Drive のファイル...」のチェックを入れてから「続行」を押してください。",
};

export function GoogleDriveIntegrationCard({
  initialIntegration,
  initialAutoSave,
  callbackStatus,
  callbackReason,
}: Props) {
  const router = useRouter();
  const [integration, setIntegration] =
    useState<GoogleDriveIntegrationStatus>(initialIntegration);
  const [autoSave, setAutoSave] = useState(initialAutoSave);
  const [busy, setBusy] = useState(false);
  // mount で 1 回だけ callback トーストを処理する。
  const handledCallbackRef = useRef(false);
  const currentPlan = useCurrentPlan();
  // Free プラン or プラン情報未取得時は自動保存をロック扱いにする。
  // Pro 降格後のオフ操作は許可するため、`autoSave === true` の状態は触れる。
  const driveAutoSaveLocked =
    currentPlan !== null && !currentPlan.driveAutoSaveAllowed && !autoSave;

  useEffect(() => {
    if (handledCallbackRef.current) return;
    handledCallbackRef.current = true;
    if (!callbackStatus) return;

    if (callbackStatus === "success") {
      if (!initialAutoSave) {
        toast.success("Google Drive を連携しました", {
          description: "今後の録画を自動で Drive に保存しますか?",
          duration: 10000,
          action: {
            label: "オンにする",
            onClick: async () => {
              const res = await api.api.integrations[
                "google-drive"
              ].preferences.$put({
                json: { autoSaveToDrive: true },
              });
              if (res.ok) {
                setAutoSave(true);
                toast.success("自動保存をオンにしました");
              } else {
                toast.error("自動保存の有効化に失敗しました");
              }
            },
          },
        });
      } else {
        toast.success("Google Drive を再連携しました");
      }
      router.replace("/dashboard/settings/integrations" as "/dashboard");
    } else if (callbackStatus === "error") {
      toast.error("連携に失敗しました", {
        description:
          REASON_MESSAGES[callbackReason ?? ""] ?? "もう一度お試しください。",
      });
      router.replace("/dashboard/settings/integrations" as "/dashboard");
    }
  }, [callbackStatus, callbackReason, initialAutoSave, router]);

  const startConnect = () => {
    // フルナビゲーション。OAuth リダイレクト経路の cookie を引き継ぐ必要があるため fetch ではなく location 遷移。
    window.location.href = `${env.NEXT_PUBLIC_SERVER_URL}/api/integrations/google-drive/authorize`;
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await api.api.integrations["google-drive"].disconnect.$post();
      if (!res.ok) {
        toast.error("連携の解除に失敗しました");
        return;
      }
      setIntegration({ connected: false });
      setAutoSave(false);
      toast.success("連携を解除しました");
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoSave = async (next: boolean) => {
    // Free が ON にしようとしたケースは API を叩かず CTA に誘導する
    // （API 側でも 402 で弾くが、無駄なリクエストを避けるため UI で先行判定）。
    if (next && driveAutoSaveLocked) {
      openUpgradeCtaDialog({ source: "drive_auto_save" });
      return;
    }
    const prev = autoSave;
    setAutoSave(next); // optimistic
    const res = await api.api.integrations["google-drive"].preferences.$put({
      json: { autoSaveToDrive: next },
    });
    if (!res.ok) {
      setAutoSave(prev);
      // 402 PLAN_REQUIRED の場合は api.ts 側で CTA が立ち上がるので、トーストは
      // それ以外のエラーに限定する（CTA との重複を避ける）。
      if (res.status !== 402) {
        toast.error("設定の更新に失敗しました");
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GoogleDriveLogo className="size-5" />
          Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!integration.connected ? (
          <>
            <p className="text-muted-foreground text-sm">
              録画と文字起こしをご自身の Google Drive に保存できます。
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                /Torea/
              </code>
              配下に録画ごとのフォルダを作成します。
            </p>
            <Button onClick={startConnect}>Google で連携する</Button>
          </>
        ) : integration.status === "revoked" ? (
          <>
            <div className="flex items-center gap-2 text-amber-600 text-sm dark:text-amber-400">
              <AlertTriangleIcon className="size-4" />
              連携が失効しています。再連携してください。
            </div>
            <Button onClick={startConnect}>再連携する</Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
              <span className="break-all">
                {integration.googleEmail} に連携中
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="auto-save" className="flex items-center gap-2">
                  自動保存
                  {driveAutoSaveLocked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      <LockIcon className="size-2.5" />
                      Pro でロック解除
                    </span>
                  ) : null}
                </Label>
                <p className="text-muted-foreground text-xs">
                  録画完了後、自動で Drive
                  に保存します。文字起こしも完了後に追加されます。
                </p>
              </div>
              <Switch
                id="auto-save"
                checked={autoSave}
                onCheckedChange={toggleAutoSave}
                disabled={busy || driveAutoSaveLocked}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="outline" size="sm" disabled={busy} />}
              >
                連携を解除する
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>連携を解除しますか?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Drive
                    上の既存ファイルは削除されません。今後の自動・手動保存は無効になります。再度ご利用いただくには再連携が必要です。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={disconnect} variant="destructive">
                    解除する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleDriveLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Google Drive"
    >
      <title>Google Drive</title>
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
