/**
 * 録画詳細画面で使う型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 *
 * recordings 一覧と共有する型 (Recording / CommentThread / ViewStats) は親の
 * `../../_lib/types.ts` 側に置いてあり、ここでは録画詳細でしか使わない型のみ定義する。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type RecordingsApi = Client["api"]["recordings"];
type IntegrationsApi = Client["api"]["integrations"]["google-drive"];

// ---------- transcription ----------

/** GET /api/recordings/:id/transcription */
export type TranscriptionData = InferResponseType<
  RecordingsApi[":id"]["transcription"]["$get"],
  200
>;

// ---------- drive export ----------

/** GET /api/recordings/:id/drive-export */
type DriveExportListResponse = InferResponseType<
  RecordingsApi[":id"]["drive-export"]["$get"],
  200
>;
export type DriveExport = DriveExportListResponse["exports"][number];

// ---------- google drive integration status ----------

/** GET /api/integrations/google-drive */
export type GoogleDriveIntegrationStatus = InferResponseType<
  IntegrationsApi["$get"],
  200
>;

/**
 * 録画詳細から見た Drive 連携状態。
 * 連携が無い場合や API 失敗時は connected=false にフォールバックされる。
 */
export type DriveStatus = GoogleDriveIntegrationStatus;
