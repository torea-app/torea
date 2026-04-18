/** Dashboard overview の期間切替値。server 側 Zod enum と同値を保つ。 */
export const DASHBOARD_PERIODS = ["7d", "30d", "90d", "all"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DEFAULT_PERIOD: DashboardPeriod = "30d";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "7d": "過去 7 日",
  "30d": "過去 30 日",
  "90d": "過去 90 日",
  all: "全期間",
};
