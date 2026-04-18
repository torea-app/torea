"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@torea/ui/components/ui/avatar";
import { Button } from "@torea/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@torea/ui/components/ui/dropdown-menu";
import { Textarea } from "@torea/ui/components/ui/textarea";
import {
  MoreHorizontalIcon,
  PencilIcon,
  ReplyIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { formatDuration, formatRelativeTime } from "../../../../_lib/format";
import type { CommentWithUser } from "../../../../_lib/types";

type Props = {
  comment: CommentWithUser;
  onUpdate: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onSeek: (ms: number) => void;
  onReply?: () => void;
  isTopLevel?: boolean;
};

export function CommentItem({
  comment,
  onUpdate,
  onDelete,
  onSeek,
  onReply,
  isTopLevel,
}: Props) {
  const { data: session } = authClient.useSession();
  const isAuthor = session?.user?.id === comment.userId;
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  async function handleSaveEdit() {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    await onUpdate(comment.id, trimmed);
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setEditBody(comment.body);
    setIsEditing(false);
  }

  async function handleDelete() {
    await onDelete(comment.id);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      handleCancelEdit();
    }
  }

  return (
    <div className="group flex gap-3">
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
              {formatDuration(comment.timestampMs)}
            </button>
          )}
          <span className="text-muted-foreground text-xs">
            {formatRelativeTime(comment.createdAt)}
            {comment.createdAt !== comment.updatedAt && " (編集済み)"}
          </span>

          {isAuthor && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7 opacity-0 group-hover:opacity-100"
                  />
                }
              >
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <PencilIcon className="mr-2 size-4" />
                  編集
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2Icon className="mr-2 size-4" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editBody.trim()}
              >
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
        )}

        {isTopLevel && onReply && !isEditing && (
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
