import {
  DriveQuotaExceededError,
  DriveRateLimitedError,
  DriveTokenRevokedError,
} from "../../domain/errors/drive.error";
import type { DriveExportErrorCode } from "../../domain/types/google-drive";
import { TokenRevokedError } from "./authed-drive-client";
import { DriveApiError } from "./drive-client";

/**
 * Drive API / token-provider が投げた失敗を、UI / DB / Queue retry 判定で
 * 使える純粋なオブジェクトに正規化する。
 *
 * use-case 層は `DriveApiError` / `TokenRevokedError` の具体クラスを知らずに
 * このオブジェクトだけを見て判断できる (= infrastructure 層の漏れを防ぐ)。
 */
export type MappedDriveError = {
  errorCode: DriveExportErrorCode;
  errorMessage: string;
  /** Queue で再エンキューすべきか。容量不足 / 認可失効 / 不明 4xx は false。 */
  retryable: boolean;
};

export function mapDriveError(err: unknown): MappedDriveError {
  if (err instanceof TokenRevokedError) {
    return {
      errorCode: "TOKEN_REVOKED",
      errorMessage: "Google Drive の認可が失効しました",
      retryable: false,
    };
  }
  if (err instanceof DriveApiError) {
    if (err.googleReason === "storageQuotaExceeded") {
      return {
        errorCode: "INSUFFICIENT_QUOTA",
        errorMessage: "Google Drive の容量が不足しています",
        retryable: false,
      };
    }
    if (
      err.status === 429 ||
      err.googleReason === "userRateLimitExceeded" ||
      err.googleReason === "rateLimitExceeded"
    ) {
      return {
        errorCode: "RATE_LIMITED",
        errorMessage: "Google Drive のレート制限です。再試行します",
        retryable: true,
      };
    }
    if (err.status === 401 || err.googleReason === "authError") {
      return {
        errorCode: "TOKEN_REVOKED",
        errorMessage: "Google Drive の認可が失効しました",
        retryable: false,
      };
    }
    if (err.status >= 500) {
      return {
        errorCode: "NETWORK_ERROR",
        errorMessage: `Google Drive: ${err.status}`,
        retryable: true,
      };
    }
    return {
      errorCode: "UNKNOWN",
      errorMessage:
        `Google Drive: ${err.status} ${err.googleReason ?? ""}`.trim(),
      retryable: false,
    };
  }
  // ネットワーク/その他
  return {
    errorCode: "NETWORK_ERROR",
    errorMessage: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    retryable: true,
  };
}

// 連携 API 層 (routes / cron) から domain エラーへの変換が必要なケース向けに
// 同名 re-export を提供する (use-case 層は domain/errors から直接 import するため不要)。
export {
  DriveQuotaExceededError,
  DriveRateLimitedError,
  DriveTokenRevokedError,
};
