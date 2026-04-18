import { createServerApi } from "@/lib/api.server";
import { type ApiResult, handleApiResponse } from "@/lib/handle-api-response";
import type {
  WebhookDeliveriesResponse,
  WebhookDelivery,
  WebhookEndpoint,
  WebhookListResponse,
} from "./types";

export async function listWebhookEndpoints(opts: {
  limit: number;
  offset: number;
}): Promise<ApiResult<WebhookListResponse>> {
  const api = await createServerApi();
  const res = await api.api.webhooks.$get({
    query: {
      limit: String(opts.limit),
      offset: String(opts.offset),
    },
  });
  return handleApiResponse<WebhookListResponse>(res);
}

export async function getWebhookEndpoint(
  id: string,
): Promise<ApiResult<WebhookEndpoint>> {
  const api = await createServerApi();
  const res = await api.api.webhooks[":id"].$get({ param: { id } });
  const result = await handleApiResponse<{ endpoint: WebhookEndpoint }>(res);
  if (!result.success) return result;
  return { success: true, data: result.data.endpoint };
}

export async function listWebhookDeliveries(opts: {
  endpointId?: string;
  limit: number;
  offset: number;
}): Promise<ApiResult<WebhookDeliveriesResponse>> {
  const api = await createServerApi();
  const query: Record<string, string> = {
    limit: String(opts.limit),
    offset: String(opts.offset),
  };
  if (opts.endpointId) query.endpointId = opts.endpointId;
  const res = await api.api.webhooks.deliveries.$get({ query });
  return handleApiResponse<WebhookDeliveriesResponse>(res);
}

export async function getWebhookDelivery(
  deliveryId: string,
): Promise<ApiResult<WebhookDelivery>> {
  const api = await createServerApi();
  const res = await api.api.webhooks.deliveries[":deliveryId"].$get({
    param: { deliveryId },
  });
  const result = await handleApiResponse<{ delivery: WebhookDelivery }>(res);
  if (!result.success) return result;
  return { success: true, data: result.data.delivery };
}
