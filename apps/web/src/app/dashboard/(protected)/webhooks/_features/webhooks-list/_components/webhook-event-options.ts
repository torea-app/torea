import type { WebhookEventName } from "../../../_lib/types";

export type WebhookEventOption = {
  name: WebhookEventName;
  label: string;
  category: "recording" | "transcription";
};

export const WEBHOOK_EVENT_OPTIONS: WebhookEventOption[] = [
  { name: "recording.created", label: "録画開始", category: "recording" },
  { name: "recording.completed", label: "録画処理完了", category: "recording" },
  { name: "recording.failed", label: "録画処理失敗", category: "recording" },
  { name: "recording.deleted", label: "録画削除", category: "recording" },
  {
    name: "transcription.started",
    label: "文字起こし開始",
    category: "transcription",
  },
  {
    name: "transcription.completed",
    label: "文字起こし完了",
    category: "transcription",
  },
  {
    name: "transcription.failed",
    label: "文字起こし失敗",
    category: "transcription",
  },
];

export const CATEGORY_LABELS: Record<WebhookEventOption["category"], string> = {
  recording: "録画",
  transcription: "文字起こし",
};
