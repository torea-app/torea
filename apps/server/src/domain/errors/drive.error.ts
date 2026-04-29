import { DomainError } from "./domain.error";

/**
 * Google Drive 連携が未設定の状態でエクスポートが要求された場合。
 *
 * NOTE: code は app.ts:38-44 の statusMap に対応するもののみ使用すること。
 * statusMap 未定義の code を使うと 400 に丸まる。
 */
export class DriveNotConnectedError extends DomainError {
  constructor() {
    super("Google Drive が連携されていません", "VALIDATION_ERROR");
  }
}

/**
 * Google から invalid_grant を受領した（ユーザーが Google 側から連携を取消した、
 * もしくはリフレッシュトークンが期限切れ）状態。再連携が必要。
 */
export class DriveTokenRevokedError extends DomainError {
  constructor() {
    super(
      "Google Drive の認可が失効しています。再連携してください。",
      "UNAUTHORIZED",
    );
  }
}

/** Drive のストレージ容量不足 (HTTP 403 storageQuotaExceeded)。 */
export class DriveQuotaExceededError extends DomainError {
  constructor() {
    super("Google Drive のストレージ容量が不足しています", "VALIDATION_ERROR");
  }
}

/** Drive API の rate limit 到達 (HTTP 429 / 403 userRateLimitExceeded)。 */
export class DriveRateLimitedError extends DomainError {
  constructor() {
    super(
      "Google Drive API のレート制限に達しました。しばらく待ってから再試行してください。",
      "VALIDATION_ERROR",
    );
  }
}

/**
 * OAuth 同意画面で `drive.file` のチェックを外したまま「続行」した場合に発生。
 * Google は granular consent でデータ系スコープを未チェック default で表示するため、
 * 一括承認した直後は drive.file が付与されないことがある。connect 直後にスコープ検証で検出する。
 */
export class DriveScopeMissingError extends DomainError {
  constructor() {
    super("Drive へのアクセス権限が許可されていません", "VALIDATION_ERROR");
  }
}
