import { z } from "zod";
import {
  WEBHOOK_EVENT_NAMES,
  type WebhookEventName,
} from "../domain/types/webhook";

const eventNameSchema = z.enum(
  WEBHOOK_EVENT_NAMES as unknown as [WebhookEventName, ...WebhookEventName[]],
);

export const createWebhookEndpointSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.url().max(2048),
  description: z.string().max(500).nullable().optional(),
  events: z.array(eventNameSchema).min(1).max(WEBHOOK_EVENT_NAMES.length),
});

export const updateWebhookEndpointSchema = z
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

export const listEndpointsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listDeliveriesQuerySchema = z.object({
  endpointId: z.string().min(1).optional(),
  status: z
    .enum(["pending", "in_progress", "success", "failed", "dead"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
