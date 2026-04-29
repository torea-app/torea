/**
 * Integrations 関連の型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type IntegrationsApi = Client["api"]["integrations"]["google-drive"];

/** GET /api/integrations/google-drive */
export type GoogleDriveIntegrationStatus = InferResponseType<
  IntegrationsApi["$get"],
  200
>;

/** GET /api/integrations/google-drive/preferences */
export type GoogleDrivePreferences = InferResponseType<
  IntegrationsApi["preferences"]["$get"],
  200
>;
