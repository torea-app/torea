import { z } from "zod";

export const exportRecordingParamSchema = z.object({
  id: z.string().min(1),
});

export const updateAutoSaveSchema = z.object({
  autoSaveToDrive: z.boolean(),
});
