/** ユーザー情報付きコメント（DB JOIN 結果） */
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

/** トップレベルコメント + 返信一覧 */
export type CommentThread = CommentWithUser & {
  replies: CommentWithUser[];
};
