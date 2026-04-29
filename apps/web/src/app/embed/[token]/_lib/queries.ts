import { env } from "@torea/env/web";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { EmbedMetadata } from "./types";

/**
 * 埋め込みページのメタデータを取得する。
 *
 * 埋め込みページは Cookie ベースではなく URL の token で認証するため、
 * dashboard と同じ `createServerApi()` (Cookie 転送) は不要で、
 * サーバー側が Public に開いている `/api/share/:token` を素の fetch で叩く。
 * createServerApi() を使わない代わりに、エラーハンドリングだけは
 * `handleApiResponse` を介して `ApiResult<T>` で揃える。
 */
export async function getEmbedMetadata(
  token: string,
): Promise<ApiResult<EmbedMetadata>> {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  return handleApiResponse<EmbedMetadata>(res);
}
