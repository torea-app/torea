/**
 * recording の状態遷移:
 *   uploading → processing → completed
 *   uploading → failed
 *   processing → completed (変換失敗時も completed: fMP4 のまま配信)
 */
export type RecordingStatus =
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

/** R2 multipart upload の完了済みパート情報 */
export type UploadedPart = {
  partNumber: number;
  etag: string;
};
