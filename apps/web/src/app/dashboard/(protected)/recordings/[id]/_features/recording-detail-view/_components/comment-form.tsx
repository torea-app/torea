"use client";

import { Button } from "@torea/ui/components/ui/button";
import { Checkbox } from "@torea/ui/components/ui/checkbox";
import { Textarea } from "@torea/ui/components/ui/textarea";
import { SendIcon } from "lucide-react";
import { type RefObject, useCallback, useState } from "react";
import { toast } from "sonner";
import type { VideoPlayerHandle } from "./video-player";

type Props = {
  onSubmit: (params: {
    body: string;
    timestampMs: number | null;
    parentId: string | null;
  }) => Promise<void>;
  playerRef: RefObject<VideoPlayerHandle | null>;
  parentId?: string;
  onAfterSubmit?: () => void;
  placeholder?: string;
};

export function CommentForm({
  onSubmit,
  playerRef,
  parentId,
  onAfterSubmit,
  placeholder = "コメントを追加...",
}: Props) {
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
