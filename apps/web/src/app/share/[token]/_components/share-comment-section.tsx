"use client";

import { env } from "@screenbase/env/web";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@screenbase/ui/components/ui/avatar";
import { Button } from "@screenbase/ui/components/ui/button";
import { Checkbox } from "@screenbase/ui/components/ui/checkbox";
import { Separator } from "@screenbase/ui/components/ui/separator";
import { Textarea } from "@screenbase/ui/components/ui/textarea";
import { MessageSquareIcon, ReplyIcon, SendIcon } from "lucide-react";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ShareCommentThread, ShareCommentWithUser } from "../_lib/types";
import type { ShareVideoPlayerHandle } from "./share-video-player";

type Props = {
  token: string;
  playerRef: RefObject<ShareVideoPlayerHandle | null>;
  durationMs: number | null;
};

export function ShareCommentSection({ token, playerRef }: Props) {
  const [comments, setComments] = useState<ShareCommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await fetch(
          `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/comments`,
          { credentials: "include" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            comments: ShareCommentThread[];
          };
          setComments(data.comments);
        }
      } catch {
        // コメント取得失敗は無視
      } finally {
        setIsLoading(false);
      }
    }
    fetchComments();
  }, [token]);

  async function handleCreate(params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/comments`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: params.body,
          ...(params.timestampMs !== null && {
            timestampMs: params.timestampMs,
          }),
          ...(params.parentId !== null && { parentId: params.parentId }),
        }),
      },
    );

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(data?.error ?? "コメントの投稿に失敗しました");
    }

    const data = (await res.json()) as { comments: ShareCommentThread[] };
    setComments(data.comments);
  }

  function handleSeek(ms: number) {
    playerRef.current?.seekTo(ms);
  }

  if (isLoading) {
    return null;
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

      <ShareCommentForm onSubmit={handleCreate} playerRef={playerRef} />

      {comments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          まだコメントはありません
        </p>
      ) : (
        <div className="space-y-1">
          {comments.map((thread) => (
            <ShareCommentThreadItem
              key={thread.id}
              thread={thread}
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

// ---- ShareCommentForm ----

function ShareCommentForm({
  onSubmit,
  playerRef,
  parentId,
  onAfterSubmit,
  placeholder = "コメントを追加...",
}: {
  onSubmit: (params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) => Promise<void>;
  playerRef: RefObject<ShareVideoPlayerHandle | null>;
  parentId?: string;
  onAfterSubmit?: () => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const timestampMs =
        includeTimestamp && !parentId
          ? (playerRef.current?.getCurrentTimeMs() ?? null)
          : null;

      await onSubmit({
        body: trimmed,
        timestampMs,
        parentId: parentId ?? null,
      });
      setBody("");
      onAfterSubmit?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "コメントの投稿に失敗しました",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    body,
    includeTimestamp,
    isSubmitting,
    onSubmit,
    parentId,
    playerRef,
    onAfterSubmit,
  ]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        className="resize-none"
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!parentId && (
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <Checkbox
                checked={includeTimestamp}
                onCheckedChange={(checked) =>
                  setIncludeTimestamp(checked === true)
                }
              />
              再生位置にタイムスタンプを付ける
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
        >
          <SendIcon className="mr-2 size-4" />
          送信
        </Button>
      </div>
    </div>
  );
}

// ---- ShareCommentThreadItem ----

function ShareCommentThreadItem({
  thread,
  onSeek,
  onReply,
  playerRef,
}: {
  thread: ShareCommentThread;
  onSeek: (ms: number) => void;
  onReply: (params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) => Promise<void>;
  playerRef: RefObject<ShareVideoPlayerHandle | null>;
}) {
  const [isReplying, setIsReplying] = useState(false);

  return (
    <div className="rounded-lg border p-4">
      <ShareCommentItem
        comment={thread}
        onSeek={onSeek}
        isTopLevel
        onReply={() => setIsReplying(true)}
      />

      {thread.replies.length > 0 && (
        <div className="mt-3 ml-6 space-y-3 border-border border-l-2 pl-4">
          {thread.replies.map((reply) => (
            <ShareCommentItem key={reply.id} comment={reply} onSeek={onSeek} />
          ))}
        </div>
      )}

      {isReplying && (
        <div className="mt-3 ml-6 border-border border-l-2 pl-4">
          <ShareCommentForm
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

// ---- ShareCommentItem ----

function ShareCommentItem({
  comment,
  onSeek,
  isTopLevel,
  onReply,
}: {
  comment: ShareCommentWithUser;
  onSeek: (ms: number) => void;
  isTopLevel?: boolean;
  onReply?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={comment.user.image ?? undefined} />
        <AvatarFallback className="text-xs">
          {comment.user.name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{comment.user.name}</span>
          {comment.timestampMs !== null && (
            <button
              type="button"
              onClick={() => onSeek(comment.timestampMs as number)}
              className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary text-xs hover:bg-primary/20"
            >
              {formatDurationSimple(comment.timestampMs)}
            </button>
          )}
          <span className="text-muted-foreground text-xs">
            {formatRelativeTimeSimple(comment.createdAt)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
        {isTopLevel && onReply && (
          <button
            type="button"
            onClick={onReply}
            className="mt-1 flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            <ReplyIcon className="size-3" />
            返信
          </button>
        )}
      </div>
    </div>
  );
}

// ---- ヘルパー関数（share ページ内でのみ使用） ----

function formatDurationSimple(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRelativeTimeSimple(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
