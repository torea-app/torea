import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { BillingMe } from "./types";

export async function getBillingMe(): Promise<ApiResult<BillingMe>> {
  const api = await createServerApi();
  const res = await api.api.billing.me.$get();
  return handleApiResponse<BillingMe>(res);
}
