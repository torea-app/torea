import { auth } from "@screenbase/auth";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

/**
 * リクエストヘッダーからセッション情報を取得するヘルパー。
 * 認証必須でないエンドポイント（公開共有アクセス）で使用する。
 * セッションがない場合は null を返す（エラーをスローしない）。
 *
 * dep-cruiser: middleware/ は @screenbase/auth の使用が許可されている。
 * share-access.route.ts はこの関数を import することで
 * @screenbase/auth を直接 import せずにセッション情報を取得できる。
 */
export async function getSessionFromRequest(
  headers: Headers,
): Promise<{ userId: string } | null> {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return null;
  }
  return { userId: session.user.id };
}
