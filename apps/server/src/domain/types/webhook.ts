/**
 * Webhook ドメイン型。
 * 外部パッケージ依存禁止（dependency-cruiser: domain-no-external-packages）。
 */

export type WebhookEndpointStatus = "active" | "paused" | "disabled";

export type WebhookDeliveryStatus =
  | "pending"
  | "in_progress"
  | "success"
  | "failed"
  | "dead";

export type WebhookEventName =
  | "recording.created"
  | "recording.completed"
  | "recording.failed"
  | "recording.deleted"
  | "recording.drive_exported"
  | "recording.drive_export_failed"
  | "transcription.started"
  | "transcription.completed"
  | "transcription.failed";

/**
 * 実行時に enum 用途で参照する購読可能なイベント名の完全一覧。
 * `as const satisfies` によって WebhookEventName と常に同期する。
 */
export const WEBHOOK_EVENT_NAMES = [
  "recording.created",
  "recording.completed",
  "recording.failed",
  "recording.deleted",
  "recording.drive_exported",
  "recording.drive_export_failed",
  "transcription.started",
  "transcription.completed",
  "transcription.failed",
] as const satisfies readonly WebhookEventName[];

export type WebhookEndpoint = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  name: string;
  url: string;
  description: string | null;
  events: WebhookEventName[];
  secretPrefix: string;
  status: WebhookEndpointStatus;
  disabledReason: string | null;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WebhookDelivery = {
  id: string;
  endpointId: string;
  organizationId: string;
  eventName: WebhookEventName;
  eventVersion: "v1";
  eventId: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  lastStatusCode: number | null;
  lastResponseBody: string | null;
  lastErrorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
};
