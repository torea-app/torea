import { z } from "zod";

export const transcriptionParamSchema = z.object({
  id: z.string().min(1),
});
