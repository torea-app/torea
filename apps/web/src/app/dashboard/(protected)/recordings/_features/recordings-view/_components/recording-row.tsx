"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@screenbase/ui/components/ui/alert-dialog";
import { Badge } from "@screenbase/ui/components/ui/badge";
import { Button } from "@screenbase/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@screenbase/ui/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@screenbase/ui/components/ui/table";
import { MoreHorizontalIcon, PlayIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { deleteRecording } from "../../../_lib/actions";
import { formatDuration, formatFileSize } from "../../../_lib/format";
import type { Recording } from "../../../_lib/types";

const statusConfig = {
  completed: { label: "完了", variant: "default" as const },
  processing: { label: "最適化中", variant: "secondary" as const },
  uploading: { label: "アップロード中", variant: "secondary" as const },
  failed: { label: "失敗", variant: "destructive" as const },
};

export function RecordingRow({ recording }: { recording: Recording }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const status = statusConfig[recording.status];

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteRecording(recording.id);
    if (result.success) {
      toast.success("録画を削除しました");
    } else {
      toast.error(result.error);
      setIsDeleting(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="max-w-xs">
        {recording.status === "completed" ||
        recording.status === "processing" ? (
          <Link
            href={`/dashboard/recordings/${recording.id}`}
            className="block truncate font-medium hover:underline"
            title={recording.title}
          >
            {recording.title}
          </Link>
        ) : (
          <span className="block truncate font-medium" title={recording.title}>
            {recording.title}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDuration(recording.durationMs)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatFileSize(recording.fileSize)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDateTime(recording.createdAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={isDeleting}
              />
            }
          >
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">操作メニュー</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(recording.status === "completed" ||
              recording.status === "processing") && (
              <DropdownMenuItem
                render={<Link href={`/dashboard/recordings/${recording.id}`} />}
              >
                <PlayIcon className="mr-2 size-4" />
                再生
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setIsAlertOpen(true)}
            >
              <Trash2Icon className="mr-2 size-4" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog
          open={isAlertOpen}
          onOpenChange={(open) => setIsAlertOpen(open)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>録画を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                「{recording.title}」を削除します。この操作は取り消せません。
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
      </TableCell>
    </TableRow>
  );
}
