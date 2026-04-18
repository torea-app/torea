import { z } from "zod";

/** GET /api/dashboard/overview — 期間クエリ */
export const overviewQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
});
