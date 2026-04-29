/**
 * Google OAuth 2.0 client (Authorization Code Flow + PKCE)。
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleOAuthClient = ReturnType<typeof createGoogleOAuthClient>;

export function createGoogleOAuthClient(config: OAuthConfig) {
  return {
    /** authorization endpoint へのリダイレクト URL を組み立てる */
    buildAuthorizeUrl(params: {
      scope: string;
      state: string;
      codeChallenge: string;
    }): string {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", params.scope);
      // refresh_token を確実に得るために access_type=offline + prompt=consent。
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("state", params.state);
      url.searchParams.set("code_challenge", params.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },

    async exchangeCode(params: {
      code: string;
      codeVerifier: string;
    }): Promise<TokenResponse> {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: params.code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
          code_verifier: params.codeVerifier,
        }),
      });
      if (!res.ok) {
        // /token のエラー応答は { error, error_description, error_uri } のみ (RFC 6749 §5.2)。
        // token 値は含まれないので body も含めて throw して上位で原因特定できるようにする。
        const body = await res.text();
        throw new Error(`Google token exchange failed: ${res.status} ${body}`);
      }
      return res.json<TokenResponse>();
    },

    async refresh(refreshToken: string): Promise<TokenResponse> {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      if (!res.ok) {
        // invalid_grant は revoked / expired を意味する。
        // Phase 3 の token-provider が status と body の error を判別して
        // DriveTokenRevokedError に変換する。ここでは body も含めて投げる。
        const body = await res.text();
        throw new GoogleTokenRefreshError(res.status, body);
      }
      return res.json<TokenResponse>();
    },

    async revoke(token: string): Promise<void> {
      // 失敗しても DB 削除は実行するため、ここでは投げず警告のみ。
      const res = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (!res.ok) {
        console.warn(`Google revoke returned ${res.status}`);
      }
    },
  };
}

/**
 * /token エンドポイントが返した HTTP エラーを保持する。
 * status と body (JSON 文字列: { error, error_description }) を分離して
 * Phase 3 の呼び出し側が "invalid_grant" を判別できるようにする。
 */
export class GoogleTokenRefreshError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Google token refresh failed: ${status}`);
    this.name = "GoogleTokenRefreshError";
  }
}

/**
 * id_token から sub と email を抽出する。
 *
 * 署名検証は省略 (`/token` エンドポイントから TLS 経由で受信した直後の値であり、
 * Google ドメインから来た事実は TLS で担保されている)。aud だけ保険でチェックする。
 *
 * @see https://developers.google.com/identity/openid-connect/openid-connect#validatinganidtoken
 */
export function decodeIdTokenUnsafe(
  idToken: string,
  expectedAud: string,
): { sub: string; email: string } {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("malformed id_token");
  const json = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(
        atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      ),
    ),
  ) as { sub?: string; email?: string; aud?: string };
  if (json.aud !== expectedAud) {
    throw new Error("id_token audience mismatch");
  }
  if (!json.sub || !json.email) {
    throw new Error("id_token missing sub/email");
  }
  return { sub: json.sub, email: json.email };
}
