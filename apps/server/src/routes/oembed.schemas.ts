import { z } from "zod";

export const oembedQuerySchema = z.object({
  url: z.url(),
  format: z.enum(["json"]).optional().default("json"),
  maxwidth: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
  maxheight: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : undefined))
    .pipe(z.number().int().positive().optional()),
});
