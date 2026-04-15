/** 埋め込みページ用のメタデータ型 */
export type EmbedMetadata = {
  shareId: string;
  type: "org_members" | "password_protected";
  recordingTitle: string;
  mimeType: string;
  durationMs: number | null;
};
