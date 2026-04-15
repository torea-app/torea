import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { RecordingsListResponse } from "./types";

export async function getRecordings(params: {
  limit: number;
  offset: number;
}): Promise<ApiResult<RecordingsListResponse>> {
  const api = await createServerApi();
  const res = await api.api.recordings.$get({
    query: {
      limit: String(params.limit),
      offset: String(params.offset),
    },
  });
  return handleApiResponse<RecordingsListResponse>(res);
}
