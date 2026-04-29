/**
 * Google Drive 連携で使用するスコープ。
 *
 * - `openid` + `email`: id_token を発行させ、callback で sub (Google ユーザー ID) と
 *   email を取り出すために必要 (OIDC 1.0)。userinfo エンドポイントを別途叩く必要が無くなる。
 * - `drive.file`: 当アプリが作成・アップロードしたファイルのみにアクセス可能な非機密スコープ。
 *   ユーザーの既存 Drive ファイルは閲覧・変更しないため Google の年次セキュリティレビュー (CASA) も不要。
 *
 * 3 つすべて非機密スコープなので、verification は不要。
 *
 * @see https://developers.google.com/identity/protocols/oauth2/scopes#drive
 * @see https://developers.google.com/identity/openid-connect/openid-connect#scope-param
 */
/**
 * 連携の本質的な機能 (Drive 上書き保存) に必要なスコープ。
 * granular consent で外されると Drive 操作が一切できなくなるので、
 * connect 後に必ず検証する。Google は応答の `scope` 文字列で
 * `email` を `https://www.googleapis.com/auth/userinfo.email` に正規化するが、
 * `drive.file` はそのまま返るので、この URL での完全一致でチェックして良い。
 */
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_DRIVE_SCOPES = [
  "openid",
  "email",
  DRIVE_FILE_SCOPE,
] as const;

export const GOOGLE_DRIVE_SCOPE = GOOGLE_DRIVE_SCOPES.join(" ");

export type DriveExportKind = "video" | "transcript";

export type DriveExportStatus = "queued" | "uploading" | "completed" | "failed";

export type DriveExportTriggeredBy = "manual" | "auto";

/** UI に出す人間可読エラーコード。Phase 4/6 で表示文言にマップ。 */
export type DriveExportErrorCode =
  | "TOKEN_REVOKED"
  | "INSUFFICIENT_QUOTA"
  | "RATE_LIMITED"
  | "FILE_TOO_LARGE"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export type GoogleDriveAccountStatus = "active" | "revoked";
