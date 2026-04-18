import type {
  CommentThread,
  CommentWithUser,
} from "../../domain/types/comment";
import type { createCommentRepository } from "../../infrastructure/repositories/comment.repository";

type Deps = {
  repo: ReturnType<typeof createCommentRepository>;
  generateId: () => string;
};

export function createCommentService({ repo, generateId }: Deps) {
  /**
   * フラットなコメント一覧をスレッド構造に変換する。
   *
   * 1. parentId が null のコメントをトップレベルとして抽出
   * 2. parentId が not null のコメントを該当する親の replies に追加
   * 3. トップレベルを timestampMs 昇順でソート（null は末尾）
   * 4. 各スレッド内の replies は createdAt 昇順（DB ソート済み）
   */
  function buildThreads(
    rows: {
      id: string;
      recordingId: string;
      userId: string;
      parentId: string | null;
      body: string;
      timestampMs: number | null;
      createdAt: Date;
      updatedAt: Date;
      userName: string;
      userImage: string | null;
    }[],
  ): CommentThread[] {
    const toCommentWithUser = (
      row: (typeof rows)[number],
    ): CommentWithUser => ({
      id: row.id,
      recordingId: row.recordingId,
      userId: row.userId,
      parentId: row.parentId,
      body: row.body,
      timestampMs: row.timestampMs,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: {
        id: row.userId,
        name: row.userName,
        image: row.userImage,
      },
    });

    // トップレベルとリプライを分離
    const topLevel: CommentThread[] = [];
    const repliesByParentId = new Map<string, CommentWithUser[]>();

    for (const row of rows) {
      if (row.parentId === null) {
        topLevel.push({ ...toCommentWithUser(row), replies: [] });
      } else {
        const list = repliesByParentId.get(row.parentId) ?? [];
        list.push(toCommentWithUser(row));
        repliesByParentId.set(row.parentId, list);
      }
    }

    // リプライを親に紐付け
    for (const thread of topLevel) {
      thread.replies = repliesByParentId.get(thread.id) ?? [];
    }

    // timestampMs 昇順ソート（null は末尾）
    topLevel.sort((a, b) => {
      if (a.timestampMs === null && b.timestampMs === null) return 0;
      if (a.timestampMs === null) return 1;
      if (b.timestampMs === null) return -1;
      return a.timestampMs - b.timestampMs;
    });

    return topLevel;
  }

  return {
    /**
     * コメントを作成し、更新後のスレッド一覧を返す。
     */
    async createComment(params: {
      recordingId: string;
      userId: string;
      body: string;
      timestampMs: number | null;
      parentId: string | null;
    }): Promise<CommentThread[]> {
      // parentId のバリデーション
      if (params.parentId !== null) {
        const parent = await repo.findById(params.parentId);
        if (!parent) {
          throw new Error("Parent comment not found");
        }
        if (parent.parentId !== null) {
          throw new Error("Cannot reply to a reply");
        }
        if (parent.recordingId !== params.recordingId) {
          throw new Error("Parent comment belongs to a different recording");
        }
      }

      const commentId = generateId();
      await repo.create({
        id: commentId,
        recordingId: params.recordingId,
        userId: params.userId,
        body: params.body,
        timestampMs: params.timestampMs,
        parentId: params.parentId,
      });

      // 更新後の一覧を返す（クライアント側の状態更新用）
      const rows = await repo.findByRecording(params.recordingId);
      return buildThreads(rows);
    },

    /**
     * 録画のコメント一覧をスレッド構造で返す。
     */
    async listComments(recordingId: string): Promise<CommentThread[]> {
      const rows = await repo.findByRecording(recordingId);
      return buildThreads(rows);
    },

    /**
     * コメント本文を更新する。
     */
    async updateComment(params: {
      commentId: string;
      userId: string;
      body: string;
    }): Promise<void> {
      const existing = await repo.findById(params.commentId);
      if (!existing) {
        throw new Error("Comment not found");
      }
      if (existing.userId !== params.userId) {
        throw new Error("Not authorized to edit this comment");
      }
      await repo.update(params.commentId, params.body);
    },

    /**
     * コメントを削除する。
     */
    async deleteComment(params: {
      commentId: string;
      userId: string;
    }): Promise<void> {
      const existing = await repo.findById(params.commentId);
      if (!existing) {
        throw new Error("Comment not found");
      }
      if (existing.userId !== params.userId) {
        throw new Error("Not authorized to delete this comment");
      }
      await repo.delete(params.commentId);
    },
  };
}
