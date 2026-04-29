"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  type BillingInterval,
  formatPriceJpy,
  formatRecordingMaxLength,
  formatRecordingMonthlyLimit,
  formatRetention,
  formatStorage,
  PLAN_LIMITS,
  type PlanId,
} from "@/lib/pricing";

type FreeProps = {
  plan: "free";
  currentPlan: PlanId | null;
};

type ProProps = {
  plan: "pro";
  currentPlan: PlanId | null;
  interval: BillingInterval;
  priceJpy: number;
};

type Props = FreeProps | ProProps;

export function PlanCard(props: Props) {
  const limits = PLAN_LIMITS[props.plan];
  const isCurrent = props.currentPlan === props.plan;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardHeader className="p-0">
        <CardTitle className="font-semibold text-2xl">
          {props.plan === "free" ? "Free" : "Pro"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-0">
        {props.plan === "pro" ? (
          <div>
            <p className="font-bold text-3xl">
              {formatPriceJpy(
                props.priceJpy,
                props.interval === "year" ? "/ 年" : "/ 月",
              )}
            </p>
            {props.interval === "year" ? (
              <p className="mt-1 text-muted-foreground text-xs">
                月あたり ¥
                {Math.round(props.priceJpy / 12).toLocaleString("ja-JP")} 相当
              </p>
            ) : null}
          </div>
        ) : (
          <p className="font-bold text-3xl">¥0</p>
        )}
        <ul className="flex flex-col gap-2 text-sm">
          <FeatureItem>
            1 本あたり最大{" "}
            {formatRecordingMaxLength(limits.maxRecordingDurationMs)}
          </FeatureItem>
          <FeatureItem>
            月の総録画時間{" "}
            {formatRecordingMonthlyLimit(limits.monthlyRecordingDurationMs)}
          </FeatureItem>
          <FeatureItem>
            保持期間 {formatRetention(limits.retentionDays)}
          </FeatureItem>
          <FeatureItem>
            ストレージ {formatStorage(limits.storageGb)}
          </FeatureItem>
          <FeatureItem>
            解像度{" "}
            {limits.availableQualities.includes("ultra")
              ? "4K まで"
              : "1080p まで"}
          </FeatureItem>
          <FeatureItem>
            Drive 自動保存{" "}
            {limits.driveAutoSaveAllowed ? "あり" : "なし（手動のみ）"}
          </FeatureItem>
        </ul>
        <div className="mt-auto pt-2">
          <PlanCta {...props} isCurrent={isCurrent} />
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function PlanCta(props: Props & { isCurrent: boolean }) {
  if (props.plan === "free") {
    if (props.currentPlan === null) {
      return (
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/sign-up" />}
        >
          無料で始める
        </Button>
      );
    }
    return (
      <Button variant="outline" className="w-full" disabled>
        {props.isCurrent ? "現在のプラン" : "ダウングレードは管理画面から"}
      </Button>
    );
  }

  // Pro
  if (props.isCurrent) {
    return (
      <Button className="w-full" disabled>
        現在のプラン
      </Button>
    );
  }
  if (props.currentPlan === null) {
    return (
      <Button
        className="w-full"
        nativeButton={false}
        render={
          <Link href={{ pathname: "/sign-up", query: { next: "/pricing" } }} />
        }
      >
        サインアップして Pro にする
      </Button>
    );
  }
  return <ProUpgradeButton interval={props.interval} />;
}

function ProUpgradeButton({ interval }: { interval: BillingInterval }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await authClient.subscription.upgrade({
        plan: "pro",
        annual: interval === "year",
        successUrl: `${origin}/dashboard/settings/billing?status=success`,
        cancelUrl: `${origin}/pricing?status=canceled`,
      });
      if (res.error) {
        toast.error("チェックアウトの起動に失敗しました", {
          description: res.error.message,
        });
        setBusy(false);
        return;
      }
      // upgrade() は { url } を data に返し、redirect: true がデフォルトで自動遷移する。
      // 自動遷移しないケース（既存サブスクの即時アップグレード等）に備えて手動リダイレクトもする。
      const url = res.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      // url が無い場合は Stripe 側のサブスク変更が即時完了している。
      window.location.href = "/dashboard/settings/billing?status=success";
    } catch (e) {
      console.error("[subscription.upgrade] failed:", e);
      toast.error("チェックアウトの起動に失敗しました");
      setBusy(false);
    }
  };

  return (
    <Button type="button" onClick={onClick} disabled={busy} className="w-full">
      {busy ? "読み込み中..." : "Pro を始める"}
    </Button>
  );
}
