import { z } from "zod";

/** コメント作成リクエストボディ */
export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "コメント本文は必須です")
    .max(2000, "コメントは2000文字以内で入力してください"),
  timestampMs: z
    .number()
    .int()
    .min(0, "タイムスタンプは0以上である必要があります")
    .optional()
    .default(null as unknown as number)
    .transform((v) => v ?? null),
  parentId: z
    .string()
    .min(1)
    .optional()
    .default(null as unknown as string)
    .transform((v) => v ?? null),
});

/** コメント更新リクエストボディ */
export const updateCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "コメント本文は必須です")
    .max(2000, "コメントは2000文字以内で入力してください"),
});
