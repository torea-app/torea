/**
 * 埋め込みページ用の型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 *
 * 埋め込みページは共有ページと同じ /api/share/:token エンドポイントからメタデータを
 * 取得するため、型はそのレスポンスから導出する (shape も完全に一致する)。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type ShareAccessApi = Client["api"]["share"];

/** GET /api/share/:token (埋め込みページ用エイリアス) */
export type EmbedMetadata = InferResponseType<
  ShareAccessApi[":token"]["$get"],
  200
>;
