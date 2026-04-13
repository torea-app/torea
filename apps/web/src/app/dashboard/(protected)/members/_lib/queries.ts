import { serverAuthClient, serverFetchOptions } from "@/lib/auth-server-client";
import type { ApiResult } from "@/lib/handle-api-response";
import type { FullOrganization } from "./types";

export async function getFullOrganization(): Promise<
  ApiResult<FullOrganization>
> {
  const { data, error } =
    await serverAuthClient.organization.getFullOrganization({
      fetchOptions: await serverFetchOptions(),
    });
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "No active organization",
    };
  }
  return { success: true, data: data as unknown as FullOrganization };
}
