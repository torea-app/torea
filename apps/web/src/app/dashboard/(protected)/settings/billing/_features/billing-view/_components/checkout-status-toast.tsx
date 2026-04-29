"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Props = {
  status: string | null;
};

/**
 * Stripe Checkout から戻ってきた直後に 1 度だけトーストを出す。
 * `status=success` が付いていれば「決済が完了しました」を表示し、`?status=...` を URL から消す。
 */
export function CheckoutStatusToast({ status }: Props) {
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (!status) return;

    if (status === "success") {
      toast.success("決済が完了しました", {
        description:
          "プランの反映には数秒〜数十秒かかる場合があります。表示が変わらない場合はリロードしてください。",
      });
    } else if (status === "canceled") {
      toast.info("チェックアウトをキャンセルしました");
    }
    router.replace("/dashboard/settings/billing" as "/dashboard");
  }, [status, router]);

  return null;
}
