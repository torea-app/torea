/** Dashboard overview で扱う期間。route の Zod スキーマと型を合わせる。 */
export type DashboardPeriod = "7d" | "30d" | "90d" | "all";

/**
 * period から `since` Date（含む下限）を計算する。
 * `all` の場合は undefined を返し、呼び出し元は期間フィルタを適用しない。
 */
export function resolveSince(
  period: DashboardPeriod,
  now: Date = new Date(),
): Date | undefined {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - days);
  return since;
}
