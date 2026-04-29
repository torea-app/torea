import type { GoogleOAuthClient } from "../../infrastructure/google-drive/oauth-client";
import type { decryptToken } from "../../infrastructure/google-drive/token-encryption";
import type { GoogleDriveAccountRepository } from "../../infrastructure/repositories/google-drive-account.repository";

type Deps = {
  repo: GoogleDriveAccountRepository;
  oauth: GoogleOAuthClient;
  decrypt: typeof decryptToken;
  encryptionKeyB64: string;
};

export type DisconnectGoogleDriveService = ReturnType<
  typeof createDisconnectGoogleDriveService
>;

export function createDisconnectGoogleDriveService(deps: Deps) {
  return {
    async run(userId: string): Promise<void> {
      const acc = await deps.repo.findByUserId(userId);
      if (!acc) return; // 既に未連携なら no-op
      try {
        const refresh = await deps.decrypt(
          acc.refreshTokenEncrypted,
          deps.encryptionKeyB64,
        );
        await deps.oauth.revoke(refresh);
      } catch (err) {
        // revoke 失敗時もローカル DB 削除は実行する (dangling な認可を残さない)。
        console.warn("Drive token revoke failed", err);
      }
      await deps.repo.delete(userId);
    },
  };
}
