"use client";

import { ScrollArea } from "@screenbase/ui/components/ui/scroll-area";
import { Separator } from "@screenbase/ui/components/ui/separator";
import { AlertCircleIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatTimestamp } from "../../../_lib/format-time";
import type { VideoPlayerHandle } from "./video-player";

type TranscriptionData = {
  id: string;
  recordingId: string;
  status: "pending" | "processing" | "completed" | "failed";
  model: string;
  language: string | null;
  durationSeconds: number | null;
  fullText: string | null;
  segments: Array<{ start: number; end: number; text: string }> | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Props = {
  recordingId: string;
  playerRef: RefObject<VideoPlayerHandle | null>;
};

const POLL_INTERVAL_MS = 5000;

export function TranscriptionPanel({ recordingId, playerRef }: Props) {
  const [transcription, setTranscription] = useState<TranscriptionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTranscription = useCallback(async () => {
    try {
      const res = await api.api.recordings[":id"].transcription.$get({
        param: { id: recordingId },
      });

      if (res.status === 404) {
        setNotFound(true);
        setTranscription(null);
        return null;
      }

      if (!res.ok) return null;

      const data = (await res.json()) as TranscriptionData;
      setNotFound(false);
      setTranscription(data);
      return data;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [recordingId]);

  // 初回フェッチ
  useEffect(() => {
    fetchTranscription();
  }, [fetchTranscription]);

  // pending / processing 時のポーリング
  useEffect(() => {
    const status = transcription?.status;
    if (status !== "pending" && status !== "processing") return;

    const intervalId = setInterval(async () => {
      const data = await fetchTranscription();
      // completed / failed になったらポーリング停止
      if (data && data.status !== "pending" && data.status !== "processing") {
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [transcription?.status, fetchTranscription]);

  function handleSeek(timeSec: number) {
    playerRef.current?.seekTo(timeSec * 1000);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Separator />
        <TranscriptionHeader />
        <div className="flex items-center justify-center py-8">
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Separator />
        <TranscriptionHeader />
        <p className="py-8 text-center text-muted-foreground text-sm">
          文字起こしが利用できません
        </p>
      </div>
    );
  }

  if (!transcription) return null;

  if (
    transcription.status === "pending" ||
    transcription.status === "processing"
  ) {
    return (
      <div className="space-y-4">
        <Separator />
        <TranscriptionHeader />
        <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
          <LoaderCircleIcon className="size-4 animate-spin" />
          <span>文字起こし中...</span>
        </div>
      </div>
    );
  }

  if (transcription.status === "failed") {
    return (
      <div className="space-y-4">
        <Separator />
        <TranscriptionHeader />
        <div className="flex items-center justify-center gap-2 py-8 text-destructive text-sm">
          <AlertCircleIcon className="size-4" />
          <span>
            文字起こしに失敗しました
            {transcription.errorMessage && `：${transcription.errorMessage}`}
          </span>
        </div>
      </div>
    );
  }

  // completed
  const segments = transcription.segments ?? [];

  return (
    <div className="space-y-4">
      <Separator />
      <TranscriptionHeader count={segments.length} />
      {segments.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          文字起こし結果がありません
        </p>
      ) : (
        <ScrollArea className="max-h-96">
          <div className="space-y-1">
            {segments.map((segment, index) => (
              <div
                key={`${segment.start}-${index}`}
                className="group flex gap-3 rounded px-2 py-1.5 hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => handleSeek(segment.start)}
                  className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary text-xs hover:bg-primary/20"
                >
                  {formatTimestamp(segment.start)}
                </button>
                <span className="text-sm">{segment.text}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function TranscriptionHeader({ count }: { count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <FileTextIcon className="size-5 text-muted-foreground" />
      <h3 className="font-medium text-lg">
        文字起こし
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-muted-foreground">({count})</span>
        )}
      </h3>
    </div>
  );
}
