import { createLoader, parseAsInteger } from "nuqs/server";

/** ページネーション用の検索パラメータ定義（Server / Client 共有） */
export const recordingsSearchParams = {
  offset: parseAsInteger.withDefault(0),
};

/**
 * Server Component 用のローダー。
 * page.tsx の searchParams から型安全にパラメータを取得する。
 */
export const loadRecordingsSearchParams = createLoader(recordingsSearchParams);
