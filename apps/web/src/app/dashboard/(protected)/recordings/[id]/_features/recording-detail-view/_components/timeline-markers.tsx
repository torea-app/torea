"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@screenbase/ui/components/ui/tooltip";
import { formatDuration } from "../../../../_lib/format";
import type { CommentThread } from "../../../../_lib/types";

type Props = {
  comments: CommentThread[];
  durationMs: number;
  onSeek: (ms: number) => void;
};

export function TimelineMarkers({ comments, durationMs, onSeek }: Props) {
  if (durationMs <= 0) return null;

  const markers = comments.filter(
    (c) => c.timestampMs !== null && c.timestampMs <= durationMs,
  );

  if (markers.length === 0) return null;

  return (
    <TooltipProvider delay={200}>
      <div className="pointer-events-none absolute right-0 bottom-12 left-0 h-4">
        {markers.map((marker) => {
          const leftPercent =
            ((marker.timestampMs as number) / durationMs) * 100;
          return (
            <Tooltip key={marker.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="pointer-events-auto absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-transform hover:scale-150"
                    style={{ left: `${leftPercent}%` }}
                    aria-label={`コメント: ${formatDuration(marker.timestampMs)}`}
                  />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(marker.timestampMs as number);
                }}
              />
              <TooltipContent side="top" className="max-w-64">
                <p className="font-medium text-xs">
                  {marker.user.name} — {formatDuration(marker.timestampMs)}
                </p>
                <p className="line-clamp-2 text-xs">{marker.body}</p>
                {marker.replies.length > 0 && (
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    +{marker.replies.length} 件の返信
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
