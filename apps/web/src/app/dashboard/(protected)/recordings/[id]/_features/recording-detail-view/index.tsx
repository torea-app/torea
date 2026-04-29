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
import { Button, buttonVariants } from "@torea/ui/components/ui/button";
import { Separator } from "@torea/ui/components/ui/separator";
import { DownloadIcon, EyeIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { formatDateTime, formatDuration, formatFileSize } from "@/lib/format";
import type { CommentThread, Recording, ViewStats } from "../../../_lib/types";
import { deleteRecordingAndRedirect } from "../../_lib/actions";
import type { DriveExport } from "../../_lib/types";
import { CommentSection } from "./_components/comment-section";
import { DriveExportPanel } from "./_components/drive-export-panel";
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
  driveExports: DriveExport[];
  driveConnected: boolean;
};

export function RecordingDetailView({
  recording,
  stats,
  initialComments,
  driveExports,
  driveConnected,
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

  const unavailableMessage = getUnavailableMessage(recording.status);

  return (
    <div className="space-y-6">
      {/* ビデオプレーヤー */}
      {recording.status === "completed" ? (
        <VideoPlayer
          ref={playerRef}
          recordingId={recording.id}
          mimeType={recording.mimeType}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/50">
          <p className="text-muted-foreground text-sm">{unavailableMessage}</p>
        </div>
      )}

      {/* メタデータ & アクション */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="break-words font-semibold text-xl">
            {recording.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-sm">
            <span>{formatDateTime(recording.createdAt)}</span>
            {recording.durationMs !== null && (
              <>
                <Separator
                  orientation="vertical"
                  className="hidden h-4 sm:block"
                />
                <span>{formatDuration(recording.durationMs)}</span>
              </>
            )}
            {recording.fileSize !== null && (
              <>
                <Separator
                  orientation="vertical"
                  className="hidden h-4 sm:block"
                />
                <span>{formatFileSize(recording.fileSize)}</span>
              </>
            )}
            {stats && (
              <>
                <Separator
                  orientation="vertical"
                  className="hidden h-4 sm:block"
                />
                <span className="inline-flex items-center gap-1">
                  <EyeIcon className="size-3.5" />
                  {stats.totalViews.toLocaleString()}
                </span>
                <Separator
                  orientation="vertical"
                  className="hidden h-4 sm:block"
                />
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="size-3.5" />
                  {stats.uniqueViewers.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {recording.status === "completed" && (
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

      {/* サムネイル自動生成（completed かつ未生成の場合） */}
      {recording.status === "completed" && (
        <ThumbnailGenerator
          recordingId={recording.id}
          mimeType={recording.mimeType}
          hasThumbnail={recording.thumbnailR2Key !== null}
        />
      )}

      {/* コメントセクション（completed の場合） */}
      {recording.status === "completed" && (
        <CommentSection
          recordingId={recording.id}
          comments={comments}
          setComments={setComments}
          playerRef={playerRef}
        />
      )}

      {/* Drive エクスポートパネル（completed の場合） */}
      {recording.status === "completed" && (
        <DriveExportPanel
          recordingId={recording.id}
          initialExports={driveExports}
          driveConnected={driveConnected}
          recordingStatus={recording.status}
        />
      )}

      {/* 文字起こしセクション（completed の場合） */}
      {recording.status === "completed" && (
        <TranscriptionPanel recordingId={recording.id} playerRef={playerRef} />
      )}
    </div>
  );
}

function getUnavailableMessage(status: Recording["status"]): string {
  switch (status) {
    case "uploading":
      return "動画をアップロード中です";
    case "processing":
      return "動画を準備しています";
    default:
      return "動画を再生できません";
  }
}
