import { createServerApi } from "@/lib/api.server";
import type { ApiResult } from "@/lib/handle-api-response";
import { handleApiResponse } from "@/lib/handle-api-response";
import type {
  GoogleDriveIntegrationStatus,
  GoogleDrivePreferences,
} from "./types";

export async function getGoogleDriveIntegration(): Promise<
  ApiResult<GoogleDriveIntegrationStatus>
> {
  const api = await createServerApi();
  const res = await api.api.integrations["google-drive"].$get();
  return handleApiResponse<GoogleDriveIntegrationStatus>(res);
}

export async function getGoogleDrivePreferences(): Promise<
  ApiResult<GoogleDrivePreferences>
> {
  const api = await createServerApi();
  const res = await api.api.integrations["google-drive"].preferences.$get();
  return handleApiResponse<GoogleDrivePreferences>(res);
}
