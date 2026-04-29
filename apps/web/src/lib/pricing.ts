export {
  BILLING_INTERVALS,
  type BillingInterval,
  PLAN_IDS,
  PLAN_LIMITS,
  PLAN_PRICES_JPY,
  type PlanId,
  type PlanLimits,
  planMeets,
  QUALITY_PRESETS,
  type QualityPreset,
} from "@torea/shared";

/** "120 分" / "無制限" のような表示文字列を返す。 */
export function formatRecordingMonthlyLimit(ms: number): string {
  if (ms < 0) return "無制限";
  return `${Math.round(ms / 60_000)} 分`;
}

/** "30 分" / "3 時間" のような表示文字列を返す。 */
export function formatRecordingMaxLength(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} 時間`;
  return `${hours} 時間 ${remaining} 分`;
}

/** "100 GB" / "保持期間で制御" 等。 */
export function formatStorage(gb: number | null): string {
  if (gb === null) return "保持期間で制御";
  return `${gb} GB`;
}

/** "14 日" / "無期限" 等。 */
export function formatRetention(days: number | null): string {
  if (days === null) return "無期限";
  return `${days} 日`;
}

/** "¥1,500 / 月" 等。 */
export function formatPriceJpy(amount: number, suffix: string): string {
  return `¥${amount.toLocaleString("ja-JP")} ${suffix}`;
}
