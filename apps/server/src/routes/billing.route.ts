import { createId } from "@paralleldrive/cuid2";
import { getCurrentPeriodStart, PLAN_LIMITS } from "@torea/shared";
import { Hono } from "hono";
import { createSubscriptionRepository } from "../infrastructure/repositories/subscription.repository";
import { createUsageQuotaRepository } from "../infrastructure/repositories/usage-quota.repository";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types";
import { createGetCurrentPlanService } from "../use-cases/billing/get-current-plan.service";

export const billingRoute = new Hono<AppEnv>()
  .use("/*", authMiddleware)

  // GET /api/billing/me — 現在のプラン + 今月の使用量
  .get("/me", async (c) => {
    const user = c.get("user");

    const subRepo = createSubscriptionRepository(c.env.DB);
    const quotaRepo = createUsageQuotaRepository(c.env.DB, createId);

    const planService = createGetCurrentPlanService({
      subscriptionRepo: subRepo,
    });
    const currentPlan = await planService.execute(user.id);

    const periodStart = getCurrentPeriodStart();
    const usage = await quotaRepo.ensurePeriod({
      userId: user.id,
      periodStart,
      plan: currentPlan.plan,
    });

    const limits = PLAN_LIMITS[currentPlan.plan];
    const usedMs = usage.recordingMinutesUsedX1000 * 60;
    const monthlyLimitMs = limits.monthlyRecordingDurationMs;
    const remainingMs =
      monthlyLimitMs < 0 ? -1 : Math.max(0, monthlyLimitMs - usedMs);

    return c.json({
      plan: currentPlan.plan,
      status: currentPlan.status,
      billingInterval: currentPlan.billingInterval,
      cancelAtPeriodEnd: currentPlan.cancelAtPeriodEnd,
      periodEnd: currentPlan.periodEnd?.toISOString() ?? null,
      usage: {
        periodStart: periodStart.toISOString(),
        recordingDurationUsedMs: usedMs,
        recordingDurationLimitMs: monthlyLimitMs,
        recordingDurationRemainingMs: remainingMs,
        recordingCount: usage.recordingCount,
      },
      limits: {
        maxRecordingDurationMs: limits.maxRecordingDurationMs,
        availableQualities: limits.availableQualities,
        retentionDays: limits.retentionDays,
        driveAutoSaveAllowed: limits.driveAutoSaveAllowed,
        storageGb: limits.storageGb,
      },
    });
  });
