/**
 * Webhook イベントの「封筒（envelope）」と各イベントの payload 型。
 * 外部パッケージ依存禁止（dependency-cruiser: domain-no-external-packages）。
 *
 * 受信側には以下の JSON 形で配信される:
 * {
 *   id: string,                 // event 一意 ID（冪等性キー）
 *   name: WebhookEventName,
 *   version: "v1",
 *   createdAt: ISO-8601 string,
 *   organizationId: string,
 *   payload: WebhookEventPayloads[name]
 * }
 */

import type { WebhookEventName } from "./webhook";

export type WebhookEventEnvelope<
  N extends WebhookEventName = WebhookEventName,
> = {
  id: string;
  name: N;
  version: "v1";
  createdAt: string;
  organizationId: string;
  payload: WebhookEventPayloads[N];
};

export type WebhookEventPayloads = {
  "recording.created": {
    recordingId: string;
    userId: string;
    title: string;
    createdAt: string;
  };
  "recording.completed": {
    recordingId: string;
    title: string;
    durationMs: number | null;
    fileSize: number | null;
    completedAt: string;
    thumbnailAvailable: boolean;
  };
  "recording.failed": {
    recordingId: string;
    errorCode: string;
    errorMessage: string;
  };
  "recording.deleted": {
    recordingId: string;
    deletedByUserId: string;
  };
  "recording.drive_exported": {
    recordingId: string;
    kind: "video" | "transcript";
    driveFileId: string;
    driveWebViewLink: string;
  };
  "recording.drive_export_failed": {
    recordingId: string;
    kind: "video" | "transcript";
    errorCode: string;
    errorMessage: string;
  };
  "transcription.started": {
    transcriptionId: string;
    recordingId: string;
    model: string;
  };
  "transcription.completed": {
    transcriptionId: string;
    recordingId: string;
    language: string | null;
    durationSeconds: number | null;
    /** fullText の先頭 240 文字 */
    textPreview: string;
  };
  "transcription.failed": {
    transcriptionId: string;
    recordingId: string;
    errorMessage: string;
  };
};
