import { z } from "zod";

export const shareTokenParamSchema = z.object({
  token: z.string().min(1),
});

export const verifyPasswordBodySchema = z.object({
  password: z.string().min(1, "Password is required"),
});
