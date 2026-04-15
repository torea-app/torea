export type ShareMetadata = {
  shareId: string;
  type: "org_members" | "password_protected";
  recordingTitle: string;
  mimeType: string;
  durationMs: number | null;
};

/** ユーザー情報付きコメント（共有ページ用） */
export type ShareCommentWithUser = {
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

/** コメントスレッド（共有ページ用） */
export type ShareCommentThread = ShareCommentWithUser & {
  replies: ShareCommentWithUser[];
};
