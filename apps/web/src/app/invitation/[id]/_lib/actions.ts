"use server";

import { z } from "zod";
import { serverAuthClient, serverFetchOptions } from "@/lib/auth-server-client";
import type { ApiResult } from "@/lib/handle-api-response";

const invitationIdSchema = z.string().min(1, "Invitation ID is required");

export async function acceptInvitation(
  invitationId: string,
): Promise<ApiResult<void>> {
  const parsed = invitationIdSchema.safeParse(invitationId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { error } = await serverAuthClient.organization.acceptInvitation(
    { invitationId: parsed.data },
    await serverFetchOptions(),
  );
  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to accept invitation",
    };
  }
  return { success: true, data: undefined };
}

export async function rejectInvitation(
  invitationId: string,
): Promise<ApiResult<void>> {
  const parsed = invitationIdSchema.safeParse(invitationId);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { error } = await serverAuthClient.organization.rejectInvitation(
    { invitationId: parsed.data },
    await serverFetchOptions(),
  );
  if (error) {
    return {
      success: false,
      error: error.message ?? "Failed to reject invitation",
    };
  }
  return { success: true, data: undefined };
}
