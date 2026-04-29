import { DriveScopeMissingError } from "../../domain/errors/drive.error";
import { DRIVE_FILE_SCOPE } from "../../domain/types/google-drive";
// dep-cruiser: use-cases-no-infrastructure-impl により infrastructure/ (repositories 以外) は
// type import のみ。具体実装は routes 層で DI 経由で渡す。
import type {
  decodeIdTokenUnsafe,
  GoogleOAuthClient,
} from "../../infrastructure/google-drive/oauth-client";
import type { encryptToken } from "../../infrastructure/google-drive/token-encryption";
import type { GoogleDriveAccountRepository } from "../../infrastructure/repositories/google-drive-account.repository";

type Deps = {
  repo: GoogleDriveAccountRepository;
  oauth: GoogleOAuthClient;
  encrypt: typeof encryptToken;
  decode: typeof decodeIdTokenUnsafe;
  encryptionKeyB64: string;
  oauthClientId: string;
  generateId: () => string;
};

export type ConnectGoogleDriveService = ReturnType<
  typeof createConnectGoogleDriveService
>;

export function createConnectGoogleDriveService(deps: Deps) {
  return {
    async handleCallback(params: {
      code: string;
      codeVerifier: string;
      userId: string;
    }): Promise<void> {
      const tokens = await deps.oauth.exchangeCode({
        code: params.code,
        codeVerifier: params.codeVerifier,
      });
      if (!tokens.refresh_token) {
        // access_type=offline + prompt=consent を毎回付けているため通常は来ない。
        throw new Error("Google did not return refresh_token");
      }
      if (!tokens.id_token) {
        throw new Error("Google did not return id_token");
      }

      // granular consent で drive.file チェックを外したまま「続行」されたケースを検出。
      // Google が返す `scope` は実際に付与された分のみ (RFC 6749 §5.1)。
      const grantedScopes = new Set(tokens.scope.split(/\s+/));
      if (!grantedScopes.has(DRIVE_FILE_SCOPE)) {
        // Google アカウント設定の "サードパーティアクセス" に幽霊エントリが残らないよう
        // 部分許可で得たトークンは破棄する。失敗しても進める (revoke は警告のみ)。
        await deps.oauth.revoke(tokens.refresh_token);
        throw new DriveScopeMissingError();
      }

      const idTokenInfo = deps.decode(tokens.id_token, deps.oauthClientId);
      const accessTokenEncrypted = await deps.encrypt(
        tokens.access_token,
        deps.encryptionKeyB64,
      );
      const refreshTokenEncrypted = await deps.encrypt(
        tokens.refresh_token,
        deps.encryptionKeyB64,
      );

      await deps.repo.upsert({
        id: deps.generateId(),
        userId: params.userId,
        googleSubject: idTokenInfo.sub,
        googleEmail: idTokenInfo.email,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        scope: tokens.scope,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: "active",
      });
    },
  };
}
