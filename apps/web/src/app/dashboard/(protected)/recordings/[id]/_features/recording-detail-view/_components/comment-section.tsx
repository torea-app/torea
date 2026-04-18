"use client";

import { Separator } from "@torea/ui/components/ui/separator";
import { MessageSquareIcon } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CommentThread } from "../../../../_lib/types";
import { CommentForm } from "./comment-form";
import { CommentThreadItem } from "./comment-thread-item";
import type { VideoPlayerHandle } from "./video-player";

type Props = {
  recordingId: string;
  comments: CommentThread[];
  setComments: Dispatch<SetStateAction<CommentThread[]>>;
  playerRef: RefObject<VideoPlayerHandle | null>;
};

export function CommentSection({
  recordingId,
  comments,
  setComments,
  playerRef,
}: Props) {
  async function handleCreate(params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) {
    const res = await api.api.recordings[":id"].comments.$post({
      param: { id: recordingId },
      json: {
        body: params.body,
        ...(params.timestampMs !== null && { timestampMs: params.timestampMs }),
        ...(params.parentId !== null && { parentId: params.parentId }),
      },
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "コメントの投稿に失敗しました");
    }

    const data = (await res.json()) as { comments: CommentThread[] };
    setComments(data.comments);
  }

  async function handleUpdate(commentId: string, body: string) {
    const prev = comments;

    // 楽観的更新
    setComments((current) =>
      current.map((thread) => {
        if (thread.id === commentId) {
          return { ...thread, body, updatedAt: new Date().toISOString() };
        }
        return {
          ...thread,
          replies: thread.replies.map((reply) =>
            reply.id === commentId
              ? { ...reply, body, updatedAt: new Date().toISOString() }
              : reply,
          ),
        };
      }),
    );

    const res = await api.api.recordings[":id"].comments[":commentId"].$patch({
      param: { id: recordingId, commentId },
      json: { body },
    });

    if (!res.ok) {
      setComments(prev);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(data?.error ?? "コメントの更新に失敗しました");
    }
  }

  async function handleDelete(commentId: string) {
    const prev = comments;

    // 楽観的更新
    setComments((current) =>
      current
        .filter((thread) => thread.id !== commentId)
        .map((thread) => ({
          ...thread,
          replies: thread.replies.filter((reply) => reply.id !== commentId),
        })),
    );

    const res = await api.api.recordings[":id"].comments[":commentId"].$delete({
      param: { id: recordingId, commentId },
    });

    if (!res.ok) {
      setComments(prev);
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(data?.error ?? "コメントの削除に失敗しました");
    }
  }

  function handleSeek(ms: number) {
    playerRef.current?.seekTo(ms);
  }

  return (
    <div className="space-y-4">
      <Separator />
      <div className="flex items-center gap-2">
        <MessageSquareIcon className="size-5 text-muted-foreground" />
        <h3 className="font-medium text-lg">
          コメント
          {comments.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({comments.reduce((sum, t) => sum + 1 + t.replies.length, 0)})
            </span>
          )}
        </h3>
      </div>

      <CommentForm onSubmit={handleCreate} playerRef={playerRef} />

      {comments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          まだコメントはありません
        </p>
      ) : (
        <div className="space-y-1">
          {comments.map((thread) => (
            <CommentThreadItem
              key={thread.id}
              thread={thread}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSeek={handleSeek}
              onReply={handleCreate}
              playerRef={playerRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}
