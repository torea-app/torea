"use client";

import { Button } from "@torea/ui/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

type Props = {
  plan: "free" | "pro";
};

export function CustomerPortalLink({ plan }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (plan === "free") {
    return (
      <Button nativeButton={false} render={<Link href="/pricing" />}>
        Pro にアップグレード
      </Button>
    );
  }

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await authClient.subscription.billingPortal({
        returnUrl: `${window.location.origin}/dashboard/settings/billing`,
      });
      if (res.error) {
        toast.error("Customer Portal を開けませんでした", {
          description: res.error.message,
        });
        setBusy(false);
        return;
      }
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      // url が無いケースは想定外。最新状態に更新だけ行う。
      router.refresh();
      setBusy(false);
    } catch (e) {
      console.error("[subscription.billingPortal] failed:", e);
      toast.error("Customer Portal を開けませんでした");
      setBusy(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={busy} variant="outline">
      {busy ? "読み込み中..." : "お支払い方法・請求書を管理"}
    </Button>
  );
}
