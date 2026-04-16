"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";

const idSchema = z.string().min(1, "Recording ID is required");
const idsSchema = z.array(z.string().min(1)).min(1).max(100);

export async function deleteRecording(
  recordingId: string,
): Promise<ApiResult<void>> {
  const parsed = idSchema.safeParse(recordingId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const api = await createServerApi();
  const res = await api.api.recordings[":id"].$delete({
    param: { id: parsed.data },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      success: false,
      error:
        (body as { error?: string } | null)?.error ??
        "録画の削除に失敗しました",
    };
  }

  revalidatePath("/dashboard/recordings");
  return { success: true, data: undefined };
}

export async function deleteRecordings(
  ids: string[],
): Promise<ApiResult<{ deletedCount: number }>> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const api = await createServerApi();
  const res = await api.api.recordings["bulk-delete"].$post({
    json: { ids: parsed.data },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      success: false,
      error:
        (body as { error?: string } | null)?.error ??
        "録画の一括削除に失敗しました",
    };
  }

  const data = await res.json();
  revalidatePath("/dashboard/recordings");
  return { success: true, data };
}
