"use client";

import { type RefObject, useState } from "react";
import type { CommentThread } from "../../../../_lib/types";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import type { VideoPlayerHandle } from "./video-player";

type Props = {
  thread: CommentThread;
  onUpdate: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onSeek: (ms: number) => void;
  onReply: (params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) => Promise<void>;
  playerRef: RefObject<VideoPlayerHandle | null>;
};

export function CommentThreadItem({
  thread,
  onUpdate,
  onDelete,
  onSeek,
  onReply,
  playerRef,
}: Props) {
  const [isReplying, setIsReplying] = useState(false);

  return (
    <div className="rounded-lg border p-4">
      <CommentItem
        comment={thread}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onSeek={onSeek}
        onReply={() => setIsReplying(true)}
        isTopLevel
      />

      {thread.replies.length > 0 && (
        <div className="mt-3 ml-6 space-y-3 border-border border-l-2 pl-4">
          {thread.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSeek={onSeek}
            />
          ))}
        </div>
      )}

      {isReplying && (
        <div className="mt-3 ml-6 border-border border-l-2 pl-4">
          <CommentForm
            onSubmit={onReply}
            playerRef={playerRef}
            parentId={thread.id}
            onAfterSubmit={() => setIsReplying(false)}
            placeholder="返信を追加..."
          />
          <button
            type="button"
            onClick={() => setIsReplying(false)}
            className="mt-1 text-muted-foreground text-xs hover:underline"
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
