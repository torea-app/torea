import { createLoader, parseAsStringLiteral } from "nuqs/server";
import { DASHBOARD_PERIODS, DEFAULT_PERIOD } from "./period";

/**
 * ダッシュボード概要の検索パラメータ定義（Server / Client 共有）。
 * 不正値はデフォルトにフォールバックするため、クライアントでエラーにならない。
 */
export const dashboardSearchParams = {
  period: parseAsStringLiteral(DASHBOARD_PERIODS).withDefault(DEFAULT_PERIOD),
};

/**
 * Server Component 用のローダー。
 * page.tsx の searchParams から型安全にパラメータを取得する。
 */
export const loadDashboardSearchParams = createLoader(dashboardSearchParams);
