/**
 * Recordings 関連の型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 * Date は wire 上 JSON 文字列 (JSONParsed) として推論される。
 *
 * error レスポンス (4xx) を持つルートは status 200 で narrow し、成功型のみ公開する。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type RecordingsApi = Client["api"]["recordings"];
type SharesApi = Client["api"]["shares"];

// ---------- recordings list / detail ----------

/** GET /api/recordings */
export type RecordingsListResponse = InferResponseType<
  RecordingsApi["$get"],
  200
>;
export type Recording = RecordingsListResponse["recordings"][number];

// ---------- view analytics ----------

/** GET /api/recordings/:id/stats */
export type ViewStats = InferResponseType<
  RecordingsApi[":id"]["stats"]["$get"],
  200
>;

// ---------- comments ----------

type CommentsListResponse = InferResponseType<
  RecordingsApi[":id"]["comments"]["$get"],
  200
>;

/** トップレベルコメント (replies フィールドを持つスレッド) */
export type CommentThread = CommentsListResponse["comments"][number];

/** コメント単体 (ユーザー情報付き、replies を持たない) */
export type CommentWithUser = CommentThread["replies"][number];

// ---------- share links ----------

/** GET /api/shares?recordingId=... */
export type ShareLinksResponse = InferResponseType<SharesApi["$get"], 200>;
export type ShareLink = ShareLinksResponse["shareLinks"][number];
