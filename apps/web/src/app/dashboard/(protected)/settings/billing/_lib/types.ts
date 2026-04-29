import type { Client, InferResponseType } from "@torea/server/hc";

type BillingApi = Client["api"]["billing"];

/** GET /api/billing/me の 200 レスポンス。 */
export type BillingMe = InferResponseType<BillingApi["me"]["$get"], 200>;
