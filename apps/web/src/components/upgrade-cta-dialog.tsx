"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@torea/ui/components/ui/dialog";
import Link from "next/link";
import { type UpgradeCtaSource, useUpgradeCta } from "@/lib/upgrade-cta-store";

const COPY: Record<UpgradeCtaSource, { title: string; body: string }> = {
  quota_exceeded: {
    title: "今月の録画時間の上限に達しました",
    body: "Pro にすると月の総録画時間が無制限になります。",
  },
  single_recording_too_long: {
    title: "1 本あたりの録画時間上限を超えました",
    body: "Pro なら 1 本あたり 3 時間まで録画できます。",
  },
  quality_locked_ultra: {
    title: "4K 画質は Pro プランで利用可能です",
    body: "コードや図表をクッキリ見せたい時こそ Pro へ。",
  },
  drive_auto_save: {
    title: "Drive 自動保存は Pro プランで利用可能です",
    body: "録画完了時に Google Drive へ自動エクスポートされます。",
  },
  view_analytics_locked: {
    title: "視聴分析は Pro プランで利用可能です",
    body: "誰がどこまで見たかを録画ごとに把握できます。",
  },
};

export function UpgradeCtaDialog() {
  const { open, source, close } = useUpgradeCta();
  const copy = source ? COPY[source] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.title ?? "Pro へアップグレード"}</DialogTitle>
          {copy?.body ? (
            <DialogDescription>{copy.body}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            キャンセル
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link
                href={
                  source
                    ? { pathname: "/pricing", query: { source } }
                    : "/pricing"
                }
                onClick={close}
              />
            }
          >
            料金ページを開く
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
