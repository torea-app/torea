/**
 * Web 層から扱う Webhook 関連の型。
 *
 * 手動定義はせず、Hono RPC の `InferResponseType` でサーバールートの戻り値から
 * 型を導出する。これにより `apps/server/src/routes/webhook.route.ts` の変更が
 * そのまま web 側の型に反映され、drift が発生しない。
 *
 * Date は wire 上では JSON 文字列になるため、`InferResponseType` も自動的に
 * `string` として推論される（Hono v4 の `JSONParsed<T>`）。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type WebhooksApi = Client["api"]["webhooks"];

// ---------- list / detail / mutation responses ----------

export type WebhookListResponse = InferResponseType<WebhooksApi["$get"]>;

export type WebhookEndpoint = WebhookListResponse["endpoints"][number];

type CreateEndpointResponse = InferResponseType<WebhooksApi["$post"]>;
export type CreatedWebhookEndpoint = CreateEndpointResponse;

export type WebhookDeliveriesResponse = InferResponseType<
  WebhooksApi["deliveries"]["$get"]
>;
export type WebhookDelivery = WebhookDeliveriesResponse["deliveries"][number];

// ---------- 派生 union 型 ----------

export type WebhookEndpointStatus = WebhookEndpoint["status"];
export type WebhookDeliveryStatus = WebhookDelivery["status"];
export type WebhookEventName = WebhookEndpoint["events"][number];
