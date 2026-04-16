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
import { Button } from "@screenbase/ui/components/ui/button";
import { Checkbox } from "@screenbase/ui/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@screenbase/ui/components/ui/table";
import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRecordings } from "../../_lib/actions";
import type { Recording } from "../../_lib/types";
import { RecordingRow } from "./_components/recording-row";

type Props = {
  recordings: Recording[];
  total: number;
  limit: number;
  offset: number;
};

export function RecordingsView({ recordings, total, limit, offset }: Props) {
  const [, setOffset] = useQueryState(
    "offset",
    parseAsInteger.withDefault(0).withOptions({ shallow: false }),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ページ切り替え時に選択をクリア
  const prevOffsetRef = useRef(offset);
  if (prevOffsetRef.current !== offset) {
    prevOffsetRef.current = offset;
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  }

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  const allSelected =
    recordings.length > 0 && recordings.every((r) => selectedIds.has(r.id));
  const someSelected = recordings.some((r) => selectedIds.has(r.id));

  function handleToggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map((r) => r.id)));
    }
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    startTransition(async () => {
      const ids = Array.from(selectedIds);
      const result = await deleteRecordings(ids);
      if (result.success) {
        toast.success(`${result.data.deletedCount} 件の録画を削除しました`);
        setSelectedIds(new Set());
      } else {
        toast.error(result.error);
      }
      setIsAlertOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      {someSelected && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 px-4 py-2">
          <span className="font-medium text-sm">
            {selectedIds.size} 件選択中
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsAlertOpen(true)}
            disabled={isPending}
          >
            <Trash2Icon className="mr-1 size-4" />
            一括削除
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onCheckedChange={handleToggleAll}
                aria-label="全て選択"
              />
            </TableHead>
            <TableHead className="w-[40%]">タイトル</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>再生時間</TableHead>
            <TableHead>サイズ</TableHead>
            <TableHead>作成日時</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {recordings.map((recording) => (
            <RecordingRow
              key={recording.id}
              recording={recording}
              selected={selectedIds.has(recording.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {total} 件中 {offset + 1}–{Math.min(offset + limit, total)} 件を表示
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              <ChevronLeftIcon className="mr-1 size-4" />
              前へ
            </Button>
            <span className="px-2 text-muted-foreground text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => setOffset(offset + limit)}
            >
              次へ
              <ChevronRightIcon className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>録画を一括削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size}{" "}
              件の録画を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isPending}
              variant="destructive"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
