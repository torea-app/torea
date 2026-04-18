"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerApi } from "@/lib/api.server";
import { type ApiResult, handleApiResponse } from "@/lib/handle-api-response";
import type { WebhookEndpoint } from "./types";

const WEBHOOK_EVENT_NAMES = [
  "recording.created",
  "recording.completed",
  "recording.failed",
  "recording.deleted",
  "transcription.started",
  "transcription.completed",
  "transcription.failed",
] as const;

const eventNameSchema = z.enum(WEBHOOK_EVENT_NAMES);

const createInputSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(120),
  url: z.url("URL の形式が正しくありません").max(2048),
  description: z.string().max(500).optional(),
  events: z
    .array(eventNameSchema)
    .min(1, "少なくとも 1 つのイベントを選択してください"),
});

const updateInputSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    url: z.url().max(2048).optional(),
    description: z.string().max(500).nullable().optional(),
    events: z.array(eventNameSchema).min(1).optional(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "少なくとも 1 つのフィールドを指定してください",
  });

const idSchema = z.string().min(1);

export async function createWebhookEndpoint(
  input: z.infer<typeof createInputSchema>,
): Promise<ApiResult<{ endpoint: WebhookEndpoint; secret: string }>> {
  const parsed = createInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks.$post({ json: parsed.data });
  const result = await handleApiResponse<{
    endpoint: WebhookEndpoint;
    secret: string;
  }>(res);
  if (result.success) {
    revalidatePath("/dashboard/webhooks");
  }
  return result;
}

export async function updateWebhookEndpoint(
  id: string,
  input: z.infer<typeof updateInputSchema>,
): Promise<ApiResult<WebhookEndpoint>> {
  const idResult = idSchema.safeParse(id);
  if (!idResult.success) {
    return { success: false, error: "ID is required" };
  }
  const parsed = updateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks[":id"].$patch({
    param: { id: idResult.data },
    json: parsed.data,
  });
  const result = await handleApiResponse<{ endpoint: WebhookEndpoint }>(res);
  if (!result.success) return result;
  revalidatePath("/dashboard/webhooks");
  revalidatePath(`/dashboard/webhooks/${id}`);
  return { success: true, data: result.data.endpoint };
}

export async function deleteWebhookEndpoint(
  id: string,
): Promise<ApiResult<void>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: "ID is required" };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks[":id"].$delete({
    param: { id: parsed.data },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      success: false,
      error: (body as { error?: string } | null)?.error ?? "削除に失敗しました",
    };
  }
  revalidatePath("/dashboard/webhooks");
  return { success: true, data: undefined };
}

export async function rotateWebhookSecret(
  id: string,
): Promise<ApiResult<{ secret: string }>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: "ID is required" };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks[":id"]["rotate-secret"].$post({
    param: { id: parsed.data },
  });
  return handleApiResponse<{ secret: string }>(res);
}

export async function sendTestWebhook(
  id: string,
): Promise<ApiResult<{ deliveryId: string }>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: "ID is required" };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks[":id"].test.$post({
    param: { id: parsed.data },
  });
  const result = await handleApiResponse<{ deliveryId: string }>(res);
  if (result.success) {
    revalidatePath(`/dashboard/webhooks/${id}`);
  }
  return result;
}

export async function redeliverWebhookDelivery(
  deliveryId: string,
  endpointId: string,
): Promise<ApiResult<{ newDeliveryId: string }>> {
  const parsed = idSchema.safeParse(deliveryId);
  if (!parsed.success) {
    return { success: false, error: "Delivery ID is required" };
  }
  const api = await createServerApi();
  const res = await api.api.webhooks.deliveries[":deliveryId"].redeliver.$post({
    param: { deliveryId: parsed.data },
  });
  const result = await handleApiResponse<{ newDeliveryId: string }>(res);
  if (result.success) {
    revalidatePath(`/dashboard/webhooks/${endpointId}`);
  }
  return result;
}
