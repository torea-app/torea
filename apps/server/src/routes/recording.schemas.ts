import { z } from "zod";

/** POST /api/recordings — 録画開始 */
export const createRecordingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mimeType: z
    .string()
    .regex(/^video\/(webm|mp4)$/, "mimeType must be video/webm or video/mp4")
    .default("video/webm"),
});

/** POST /api/recordings/:id/complete — 録画完了 */
export const completeRecordingSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      }),
    )
    .min(1)
    .max(10000),
  durationMs: z.number().int().min(0).optional(),
  fileSize: z.number().int().min(0).optional(),
});

/** POST /api/recordings/bulk-delete — 一括削除 */
export const bulkDeleteRecordingsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

/** GET /api/recordings — 一覧取得 */
export const listRecordingsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
