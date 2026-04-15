import { z } from "zod";

export const createShareLinkSchema = z.discriminatedUnion("type", [
  z.object({
    recordingId: z.string().min(1, "Recording ID is required"),
    type: z.literal("org_members"),
  }),
  z.object({
    recordingId: z.string().min(1, "Recording ID is required"),
    type: z.literal("password_protected"),
    password: z.string().min(1, "Password is required").max(100),
  }),
]);

export const deleteShareLinkParamSchema = z.object({
  shareId: z.string().min(1),
});

export const listShareLinksQuerySchema = z.object({
  recordingId: z.string().min(1, "Recording ID is required"),
});
