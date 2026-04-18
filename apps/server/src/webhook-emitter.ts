/**
 * Composition Root 用ヘルパ。Webhook emitter を AppEnv bindings から組み立てる。
 * src/ 直下に置くことで、routes/ や queue consumer (index.ts) から横断的に利用可能にしている。
 *
 * use-cases 層は infrastructure の具象 (mask / repository) を value import できないため、
 * 本ヘルパが DI を担う。
 */

import { createId } from "@paralleldrive/cuid2";
import { createWebhookRepository } from "./infrastructure/repositories/webhook.repository";
import { maskSensitive } from "./infrastructure/webhook/payload-masker";
import type { AppEnv } from "./types";
import { createWebhookEmitter } from "./use-cases/webhook/webhook-emitter.service";

export function buildWebhookEmitter(env: AppEnv["Bindings"]) {
  return createWebhookEmitter({
    repo: createWebhookRepository(env.DB),
    queue: env.WEBHOOK_DELIVERY_QUEUE,
    generateId: createId,
    mask: maskSensitive,
    now: () => new Date(),
  });
}
