export type ShareLink = {
  id: string;
  recordingId: string;
  type: "org_members" | "password_protected";
  createdAt: string;
};

export type ShareLinksResponse = {
  shareLinks: ShareLink[];
};

/** サーバーから返される Recording の型 */
export type Recording = {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  status: "uploading" | "processing" | "completed" | "failed";
  r2Key: string;
  uploadId: string;
  fileSize: number | null;
  durationMs: number | null;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  thumbnailR2Key: string | null;
};

/** 一覧 API のレスポンス型 */
export type RecordingsListResponse = {
  recordings: Recording[];
  total: number;
};

/** 視聴統計 */
export type ViewStats = {
  totalViews: number;
  uniqueViewers: number;
};

/** ユーザー情報付きコメント */
export type CommentWithUser = {
  id: string;
  recordingId: string;
  userId: string;
  parentId: string | null;
  body: string;
  timestampMs: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
};

/** コメントスレッド（トップレベル + 返信） */
export type CommentThread = CommentWithUser & {
  replies: CommentWithUser[];
};
