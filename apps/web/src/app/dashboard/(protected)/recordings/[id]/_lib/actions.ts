"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerApi } from "@/lib/api.server";

const idSchema = z.string().min(1, "Recording ID is required");

export async function deleteRecordingAndRedirect(
  recordingId: string,
): Promise<{ success: false; error: string }> {
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

  redirect("/dashboard/recordings");
}
