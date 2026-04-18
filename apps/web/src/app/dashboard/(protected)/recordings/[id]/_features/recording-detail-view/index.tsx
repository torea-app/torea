"use client";

import { env } from "@torea/env/web";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@torea/ui/components/ui/alert-dialog";
import { Badge } from "@torea/ui/components/ui/badge";
import { Button, buttonVariants } from "@torea/ui/components/ui/button";
import { Separator } from "@torea/ui/components/ui/separator";
import { DownloadIcon, EyeIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { formatDuration, formatFileSize } from "../../../_lib/format";
import type { CommentThread, Recording, ViewStats } from "../../../_lib/types";
import { deleteRecordingAndRedirect } from "../../_lib/actions";
import { CommentSection } from "./_components/comment-section";
import { ShareDialog } from "./_components/share-dialog";
import { ThumbnailGenerator } from "./_components/thumbnail-generator";
import { TranscriptionPanel } from "./_components/transcription-panel";
import {
  VideoPlayer,
  type VideoPlayerHandle,
} from "./_components/video-player";

type Props = {
  recording: Recording;
  stats?: ViewStats;
  initialComments: CommentThread[];
};

export function RecordingDetailView({
  recording,
  stats,
  initialComments,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [comments, setComments] = useState<CommentThread[]>(initialComments);
  const playerRef = useRef<VideoPlayerHandle>(null);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteRecordingAndRedirect(recording.id);
    // redirect() が成功した場合はここに到達しない
    toast.error(result.error);
    setIsDeleting(false);
  }

  return (
    <div className="space-y-6">
      {/* ビデオプレーヤー */}
      {recording.status === "completed" || recording.status === "processing" ? (
        <div className="space-y-2">
          {recording.status === "processing" && (
            <Badge variant="secondary">最適化中 — 再生は可能です</Badge>
          )}
          <VideoPlayer
            ref={playerRef}
            recordingId={recording.id}
            mimeType={recording.mimeType}
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/50">
          <p className="text-muted-foreground text-sm">
            {recording.status === "uploading"
              ? "この録画はまだアップロード中です"
              : "この録画は利用できません"}
          </p>
        </div>
      )}

      {/* メタデータ & アクション */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-xl">{recording.title}</h2>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span>{formatDateTime(recording.createdAt)}</span>
            {recording.durationMs !== null && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>{formatDuration(recording.durationMs)}</span>
              </>
            )}
            {recording.fileSize !== null && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>{formatFileSize(recording.fileSize)}</span>
              </>
            )}
            {stats && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="inline-flex items-center gap-1">
                  <EyeIcon className="size-3.5" />
                  {stats.totalViews.toLocaleString()}
                </span>
                <Separator orientation="vertical" className="h-4" />
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="size-3.5" />
                  {stats.uniqueViewers.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(recording.status === "completed" ||
            recording.status === "processing") && (
            <>
              <a
                href={`${env.NEXT_PUBLIC_SERVER_URL}/api/recordings/${recording.id}/download`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <DownloadIcon className="mr-2 size-4" />
                ダウンロード
              </a>
              <ShareDialog recordingId={recording.id} />
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" size="sm" disabled={isDeleting} />
              }
            >
              <Trash2Icon className="mr-2 size-4" />
              削除
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>録画を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{recording.title}
                  」を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  variant="destructive"
                >
                  削除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* サムネイル自動生成（completed/processing かつ未生成の場合） */}
      {(recording.status === "completed" ||
        recording.status === "processing") && (
        <ThumbnailGenerator
          recordingId={recording.id}
          mimeType={recording.mimeType}
          hasThumbnail={recording.thumbnailR2Key !== null}
        />
      )}

      {/* コメントセクション（completed/processing の場合） */}
      {(recording.status === "completed" ||
        recording.status === "processing") && (
        <CommentSection
          recordingId={recording.id}
          comments={comments}
          setComments={setComments}
          playerRef={playerRef}
        />
      )}

      {/* 文字起こしセクション（completed/processing の場合） */}
      {(recording.status === "completed" ||
        recording.status === "processing") && (
        <TranscriptionPanel recordingId={recording.id} playerRef={playerRef} />
      )}
    </div>
  );
}
