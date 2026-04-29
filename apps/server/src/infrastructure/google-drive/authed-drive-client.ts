import type { GoogleDriveAccountRepository } from "../repositories/google-drive-account.repository";
import {
  type GoogleOAuthClient,
  GoogleTokenRefreshError,
} from "./oauth-client";
import { decryptToken, encryptToken } from "./token-encryption";

/**
 * トークン期限の余裕。残り 60s 未満なら refresh する。
 * Phase 4/5 の use-case 側で実際のリクエスト送信までに数百ms 〜 数秒かかるため、
 * 余裕を持って refresh しておく。
 */
const REFRESH_LEEWAY_MS = 60_000;

type Deps = {
  repo: GoogleDriveAccountRepository;
  oauth: GoogleOAuthClient;
  encryptionKeyB64: string;
};

/**
 * Google が `invalid_grant` を返した = ユーザーが Google 側で連携を取り消した
 * もしくは refresh_token が期限切れ。再連携が必要。
 *
 * Phase 4/5 の error-mapping で `DriveTokenRevokedError` (domain error) に変換される。
 */
export class TokenRevokedError extends Error {
  constructor() {
    super("invalid_grant");
    this.name = "TokenRevokedError";
  }
}

/**
 * userId に紐づく現在有効な access_token を返す関数を作る。
 *
 * - 期限内 → 復号した access_token をそのまま返す
 * - 期限切れ間近 → refresh して DB を更新し、新しい access_token を返す
 * - refresh で `invalid_grant` → `markRevoked` 後 `TokenRevokedError` を投げる
 *
 * 戻り値の関数は短命なトークンを返すため、呼び出し側はこれを保存せず
 * fetch のヘッダにすぐ載せる前提。
 */
export type TokenProvider = () => Promise<string>;

export function createTokenProvider(deps: Deps, userId: string): TokenProvider {
  return async function getAccessToken(): Promise<string> {
    const acc = await deps.repo.findByUserId(userId);
    if (!acc || acc.status !== "active") {
      throw new TokenRevokedError();
    }

    if (acc.accessTokenExpiresAt.getTime() - Date.now() > REFRESH_LEEWAY_MS) {
      return decryptToken(acc.accessTokenEncrypted, deps.encryptionKeyB64);
    }

    const refresh = await decryptToken(
      acc.refreshTokenEncrypted,
      deps.encryptionKeyB64,
    );
    let refreshed: Awaited<ReturnType<typeof deps.oauth.refresh>>;
    try {
      refreshed = await deps.oauth.refresh(refresh);
    } catch (err) {
      if (
        err instanceof GoogleTokenRefreshError &&
        err.body.includes("invalid_grant")
      ) {
        await deps.repo.markRevoked(userId);
        throw new TokenRevokedError();
      }
      throw err;
    }

    const accessTokenEncrypted = await encryptToken(
      refreshed.access_token,
      deps.encryptionKeyB64,
    );
    const refreshTokenEncrypted = refreshed.refresh_token
      ? await encryptToken(refreshed.refresh_token, deps.encryptionKeyB64)
      : undefined;
    await deps.repo.updateTokens({
      userId,
      accessTokenEncrypted,
      accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      refreshTokenEncrypted,
    });

    return refreshed.access_token;
  };
}
