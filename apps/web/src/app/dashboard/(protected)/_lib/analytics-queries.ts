import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { DashboardOverviewResponse } from "./analytics-types";
import type { DashboardPeriod } from "./period";

/**
 * ダッシュボード概要を取得する。
 * Server Component / Server Action から呼び出す前提（Cookie 転送のため）。
 */
export async function getDashboardOverview(params: {
  period: DashboardPeriod;
}): Promise<ApiResult<DashboardOverviewResponse>> {
  const api = await createServerApi();
  const res = await api.api.dashboard.overview.$get({
    query: { period: params.period },
  });
  return handleApiResponse<DashboardOverviewResponse>(res);
}
