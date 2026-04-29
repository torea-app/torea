import { createServerApi } from "@/lib/api.server";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { CurrentPlanForPricing } from "./types";

/**
 * /pricing は公開ページ。未ログイン（cookie 無し）でも 200 で表示する必要があり、
 * 認可エラー / fetch 例外は `null` に丸める。
 */
export async function getCurrentPlanForPricing(): Promise<CurrentPlanForPricing | null> {
  try {
    const api = await createServerApi();
    const res = await api.api.billing.me.$get();
    const result = await handleApiResponse<CurrentPlanForPricing>(res);
    return result.success ? { plan: result.data.plan } : null;
  } catch {
    return null;
  }
}
