import type { UploadedPart, VideoQuality } from "../types/recording";

/** API サーバーのベース URL
 * 開発時は .env の VITE_API_URL を使用し、未設定の場合は本番 URL にフォールバックする。
 * 誤って dev サーバーへ繋がることを防ぐため、フォールバックは本番 URL にする。 */
const API_URL = import.meta.env.VITE_API_URL ?? "https://api.torea.app";

/** API エラー */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** 共通 fetch ラッパー */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`,
    );
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** 録画 API クライアント */
export const recordingApi = {
  /** POST /api/recordings — 録画開始 */
  create(data: { title?: string; mimeType?: string; quality?: VideoQuality }) {
    return apiFetch<{ id: string; uploadId: string; r2Key: string }>(
      "/api/recordings",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
  },

  /** PUT /api/recordings/:id/parts/:partNumber — パートアップロード */
  uploadPart(recordingId: string, partNumber: number, body: Blob) {
    return apiFetch<{ partNumber: number; etag: string }>(
      `/api/recordings/${recordingId}/parts/${partNumber}`,
      {
        method: "PUT",
        body,
      },
    );
  },

  /** POST /api/recordings/:id/complete — 録画完了 */
  complete(
    recordingId: string,
    data: {
      parts: UploadedPart[];
      durationMs?: number;
      fileSize?: number;
    },
  ) {
    return apiFetch<{ recording: unknown }>(
      `/api/recordings/${recordingId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
  },

  /** POST /api/recordings/:id/abort — 録画中止 */
  abort(recordingId: string) {
    return apiFetch<{ success: true }>(`/api/recordings/${recordingId}/abort`, {
      method: "POST",
    });
  },
};
