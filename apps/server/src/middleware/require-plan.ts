import { type PlanId, planMeets } from "@torea/shared";
import { createMiddleware } from "hono/factory";
import { PlanRequiredError } from "../domain/errors/billing.error";
import type { CurrentPlan } from "../domain/types/billing";
import type { AppEnv } from "../types";

/**
 * 指定プラン以上を満たさないユーザーを `PlanRequiredError` で弾く。
 *
 * dep-cruiser 制約上、middleware から use-cases / infrastructure を value import
 * できないため、`getCurrentPlan` を関数として DI で受け取る。route 側で
 * `createGetCurrentPlanService(...).execute` を bind して渡すことを想定。
 *
 * 認証は前段で済ませる前提（c.get("user") を読むため authMiddleware の後に置く）。
 */
export const requirePlan = (
  required: Exclude<PlanId, "free">,
  getCurrentPlan: (userId: string) => Promise<CurrentPlan>,
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    const current = await getCurrentPlan(user.id);
    if (!planMeets(current.plan, required)) {
      throw new PlanRequiredError(
        required,
        `この機能は ${required.toUpperCase()} プラン以上で利用可能です。`,
      );
    }
    c.set("currentPlan", current);
    await next();
  });
