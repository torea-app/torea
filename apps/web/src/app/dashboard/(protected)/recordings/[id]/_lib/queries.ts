import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { CommentThread, Recording, ViewStats } from "../../_lib/types";

export async function getRecording(
  id: string,
): Promise<ApiResult<{ recording: Recording }>> {
  const api = await createServerApi();
  const res = await api.api.recordings[":id"].$get({
    param: { id },
  });
  return handleApiResponse<{ recording: Recording }>(res);
}

export async function getRecordingStats(
  id: string,
): Promise<ApiResult<ViewStats>> {
  const api = await createServerApi();
  const res = await api.api.recordings[":id"].stats.$get({
    param: { id },
  });
  return handleApiResponse<ViewStats>(res);
}

export async function getComments(
  recordingId: string,
): Promise<ApiResult<{ comments: CommentThread[] }>> {
  const api = await createServerApi();
  const res = await api.api.recordings[":id"].comments.$get({
    param: { id: recordingId },
  });
  return handleApiResponse<{ comments: CommentThread[] }>(res);
}
