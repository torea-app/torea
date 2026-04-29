import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { CommentThread, Recording, ViewStats } from "../../_lib/types";
import type { DriveExport, DriveStatus } from "./types";

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

/**
 * 録画詳細画面用に Drive エクスポート状態と連携状態をまとめて取得する。
 * 部分失敗 (Drive 未連携 / API 失敗) は connected=false / exports=[] に
 * フォールバックして success として返し、パネル側で適切な空状態を出す。
 * createServerApi() 自体の失敗のみ ApiResult のエラーとして伝播する。
 */
export async function getDriveExportContext(recordingId: string): Promise<
  ApiResult<{
    exports: DriveExport[];
    driveStatus: DriveStatus;
  }>
> {
  const api = await createServerApi();
  const [exportsRes, driveRes] = await Promise.all([
    api.api.recordings[":id"]["drive-export"].$get({
      param: { id: recordingId },
    }),
    api.api.integrations["google-drive"].$get(),
  ]);
  const exports = exportsRes.ok ? (await exportsRes.json()).exports : [];
  const driveStatus: DriveStatus = driveRes.ok
    ? await driveRes.json()
    : { connected: false };
  return { success: true, data: { exports, driveStatus } };
}
