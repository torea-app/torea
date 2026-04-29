"use client";

import type { Client, InferResponseType } from "@torea/server/hc";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type BillingMe = InferResponseType<Client["api"]["billing"]["me"]["$get"], 200>;

export type CurrentPlanInfo = {
  plan: BillingMe["plan"];
  driveAutoSaveAllowed: boolean;
  availableQualities: BillingMe["limits"]["availableQualities"];
};

/**
 * クライアント側の動的プラン判定用フック。
 * Server Component で fetch するのが原則だが、機能ロックの UI 切替（例: Drive
 * 自動保存スイッチのグレーアウト）は client 側でも判定したいので、限定的に
 * 提供する。`null` のときは未取得 / 未認証 / fetch 失敗のいずれか。
 */
export function useCurrentPlan(): CurrentPlanInfo | null {
  const [data, setData] = useState<CurrentPlanInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.api.billing.me.$get().catch(() => null);
      if (!res || !res.ok || cancelled) return;
      const body = (await res.json().catch(() => null)) as BillingMe | null;
      if (!body || cancelled) return;
      setData({
        plan: body.plan,
        driveAutoSaveAllowed: body.limits.driveAutoSaveAllowed,
        availableQualities: body.limits.availableQualities,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
