import { DomainError } from "./domain.error";

/**
 * プランの月間利用量上限に達したか、単一の操作（例: 1 本の録画）が
 * プランの上限を超えている場合に投げる。
 *
 * NOTE: code は app.ts の statusMap で 402 Payment Required にマップされる。
 */
export class QuotaExceededError extends DomainError {
  constructor(
    public readonly reason: "monthly_total" | "single_recording_too_long",
    message: string,
  ) {
    super(message, "PLAN_QUOTA_EXCEEDED");
  }
}

/**
 * 機能が現プランで許可されていない（例: Free で 4K プリセット要求）場合に投げる。
 *
 * NOTE: code は app.ts の statusMap で 402 Payment Required にマップされる。
 */
export class PlanRequiredError extends DomainError {
  constructor(
    public readonly required: "pro",
    message: string,
  ) {
    super(message, "PLAN_REQUIRED");
  }
}
