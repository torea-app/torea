/**
 * 共有ページ関連の型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 * Date は wire 上 JSON 文字列 (JSONParsed) として推論される。
 *
 * error レスポンス (4xx) を持つルートは status 200 で narrow し、成功型のみ公開する。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type ShareAccessApi = Client["api"]["share"];

/** GET /api/share/:token */
export type ShareMetadata = InferResponseType<
  ShareAccessApi[":token"]["$get"],
  200
>;

/** GET /api/share/:token/comments */
type ShareCommentsResponse = InferResponseType<
  ShareAccessApi[":token"]["comments"]["$get"],
  200
>;

/** 共有ページ用トップレベルコメント (replies を持つスレッド) */
export type ShareCommentThread = ShareCommentsResponse["comments"][number];

/** 共有ページ用コメント単体 (ユーザー情報付き、replies を持たない) */
export type ShareCommentWithUser = ShareCommentThread["replies"][number];
