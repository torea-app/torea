/**
 * PKCE (Proof Key for Code Exchange) 用の state / code_verifier 永続化。
 *
 * authorize リクエスト時に state を生成し KV に保存、callback 時に取得と同時に削除する
 * (再利用攻撃防止)。TTL は OAuth 同意画面から戻ってくるまでの時間として 5 分。
 */

type State = {
  userId: string;
  codeVerifier: string;
  returnTo?: string;
};

const PREFIX = "oauth:google-drive:state:";
const TTL_SEC = 300;

export function createPkceStateStore(kv: KVNamespace) {
  return {
    async put(state: string, value: State): Promise<void> {
      await kv.put(PREFIX + state, JSON.stringify(value), {
        expirationTtl: TTL_SEC,
      });
    },
    async take(state: string): Promise<State | null> {
      const raw = await kv.get(PREFIX + state);
      if (!raw) return null;
      // 取得と同時に削除して再利用攻撃を防ぐ。
      await kv.delete(PREFIX + state);
      try {
        return JSON.parse(raw) as State;
      } catch {
        return null;
      }
    },
  };
}

/**
 * 32 bytes ランダムから state / code_verifier / code_challenge (S256) を生成する。
 * code_challenge は SHA-256(verifier) の base64url。
 */
export async function generatePkce(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    ),
  );
  return { codeVerifier: verifier, codeChallenge: challenge, state };
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
