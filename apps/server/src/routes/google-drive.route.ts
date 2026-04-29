import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { planMeets } from "@torea/shared";
import { updateAutoSaveSchema } from "@torea/shared/schemas";
import { Hono } from "hono";
import { PlanRequiredError } from "../domain/errors/billing.error";
import { DriveScopeMissingError } from "../domain/errors/drive.error";
import { GOOGLE_DRIVE_SCOPE } from "../domain/types/google-drive";
import {
  createGoogleOAuthClient,
  decodeIdTokenUnsafe,
} from "../infrastructure/google-drive/oauth-client";
import {
  createPkceStateStore,
  generatePkce,
} from "../infrastructure/google-drive/pkce-state-store";
import {
  decryptToken,
  encryptToken,
} from "../infrastructure/google-drive/token-encryption";
import { createGoogleDriveAccountRepository } from "../infrastructure/repositories/google-drive-account.repository";
import { createSubscriptionRepository } from "../infrastructure/repositories/subscription.repository";
import { createUserIntegrationPreferenceRepository } from "../infrastructure/repositories/user-integration-preference.repository";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types";
import { createGetCurrentPlanService } from "../use-cases/billing/get-current-plan.service";
import { createConnectGoogleDriveService } from "../use-cases/google-drive/connect-google-drive.service";
import { createDisconnectGoogleDriveService } from "../use-cases/google-drive/disconnect-google-drive.service";
import { createIntegrationPreferencesService } from "../use-cases/google-drive/preferences.service";

/**
 * CORS_ORIGIN (カンマ区切り) から最初の http(s) オリジンを抽出して
 * 連携完了後のリダイレクト先 (web) を組み立てる。
 * chrome-extension:// は除外する。
 */
function getWebOrigin(corsOrigin: string): string {
  const list = corsOrigin.split(",").map((o) => o.trim());
  return list.find((o) => o.startsWith("http")) ?? list[0] ?? "";
}

const SETTINGS_PATH = "/dashboard/settings/integrations";

export const googleDriveRoute = new Hono<AppEnv>()
  .use("/*", authMiddleware)

  // ===========================================================================
  // GET /api/integrations/google-drive — 連携状態
  // ===========================================================================
  .get("/", async (c) => {
    const userId = c.get("user").id;
    const repo = createGoogleDriveAccountRepository(c.env.DB);
    const acc = await repo.findByUserId(userId);
    if (!acc) {
      return c.json({ connected: false } as const);
    }
    return c.json({
      connected: acc.status === "active",
      googleEmail: acc.googleEmail,
      status: acc.status,
      connectedAt: acc.createdAt,
    });
  })

  // ===========================================================================
  // GET /api/integrations/google-drive/authorize — OAuth 開始
  // ===========================================================================
  .get("/authorize", async (c) => {
    const userId = c.get("user").id;
    const { codeVerifier, codeChallenge, state } = await generatePkce();
    const store = createPkceStateStore(c.env.KV);
    await store.put(state, { userId, codeVerifier });

    const oauth = createGoogleOAuthClient({
      clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: c.env.GOOGLE_OAUTH_REDIRECT_URI,
    });
    const url = oauth.buildAuthorizeUrl({
      scope: GOOGLE_DRIVE_SCOPE,
      state,
      codeChallenge,
    });
    return c.redirect(url, 302);
  })

  // ===========================================================================
  // GET /api/integrations/google-drive/callback
  // ===========================================================================
  .get("/callback", async (c) => {
    const webOrigin = getWebOrigin(c.env.CORS_ORIGIN);

    // OAuth 同意画面でユーザーが拒否したり Google がエラーを返した場合
    const errParam = c.req.query("error");
    if (errParam) {
      return c.redirect(
        `${webOrigin}${SETTINGS_PATH}?status=error&reason=${encodeURIComponent(errParam)}`,
        302,
      );
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.redirect(
        `${webOrigin}${SETTINGS_PATH}?status=error&reason=missing_params`,
        302,
      );
    }

    const store = createPkceStateStore(c.env.KV);
    const stored = await store.take(state);
    const userId = c.get("user").id;
    if (!stored || stored.userId !== userId) {
      return c.redirect(
        `${webOrigin}${SETTINGS_PATH}?status=error&reason=invalid_state`,
        302,
      );
    }

    const oauth = createGoogleOAuthClient({
      clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: c.env.GOOGLE_OAUTH_REDIRECT_URI,
    });
    const service = createConnectGoogleDriveService({
      repo: createGoogleDriveAccountRepository(c.env.DB),
      oauth,
      encrypt: encryptToken,
      decode: decodeIdTokenUnsafe,
      encryptionKeyB64: c.env.INTEGRATION_ENCRYPTION_KEY,
      oauthClientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
      generateId: createId,
    });

    try {
      await service.handleCallback({
        code,
        codeVerifier: stored.codeVerifier,
        userId,
      });
    } catch (err) {
      // granular consent で drive.file が外されたケースは UI を別文言にしたいので
      // reason を区別する。それ以外は token_exchange_failed に丸める。
      const reason =
        err instanceof DriveScopeMissingError
          ? "drive_scope_missing"
          : "token_exchange_failed";
      console.error("Google Drive connect failed", err);
      return c.redirect(
        `${webOrigin}${SETTINGS_PATH}?status=error&reason=${reason}`,
        302,
      );
    }

    return c.redirect(`${webOrigin}${SETTINGS_PATH}?status=success`, 302);
  })

  // ===========================================================================
  // GET /api/integrations/google-drive/preferences — 自動保存設定取得
  // ===========================================================================
  .get("/preferences", async (c) => {
    const userId = c.get("user").id;
    const service = createIntegrationPreferencesService({
      repo: createUserIntegrationPreferenceRepository(c.env.DB),
    });
    return c.json(await service.get(userId));
  })

  // ===========================================================================
  // PUT /api/integrations/google-drive/preferences — 自動保存設定更新
  // ===========================================================================
  .put("/preferences", zValidator("json", updateAutoSaveSchema), async (c) => {
    const userId = c.get("user").id;
    const body = c.req.valid("json");

    // 自動保存「有効化」は Pro 限定。Free は false への変更のみ許す
    // （解約 → Free 降格時に既存の有効化済み設定をユーザーが切れるようにする）。
    if (body.autoSaveToDrive === true) {
      const planService = createGetCurrentPlanService({
        subscriptionRepo: createSubscriptionRepository(c.env.DB),
      });
      const current = await planService.execute(userId);
      if (!planMeets(current.plan, "pro")) {
        throw new PlanRequiredError(
          "pro",
          "Drive 自動保存は Pro プランで利用可能です。",
        );
      }
    }

    const service = createIntegrationPreferencesService({
      repo: createUserIntegrationPreferenceRepository(c.env.DB),
    });
    await service.setAutoSave(userId, body.autoSaveToDrive);
    return c.json({ autoSaveToDrive: body.autoSaveToDrive });
  })

  // ===========================================================================
  // POST /api/integrations/google-drive/disconnect
  // ===========================================================================
  .post("/disconnect", async (c) => {
    const userId = c.get("user").id;
    const oauth = createGoogleOAuthClient({
      clientId: c.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: c.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri: c.env.GOOGLE_OAUTH_REDIRECT_URI,
    });
    const service = createDisconnectGoogleDriveService({
      repo: createGoogleDriveAccountRepository(c.env.DB),
      oauth,
      decrypt: decryptToken,
      encryptionKeyB64: c.env.INTEGRATION_ENCRYPTION_KEY,
    });
    await service.run(userId);
    return c.json({ disconnected: true } as const);
  });
