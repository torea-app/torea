"use client";

import { Button } from "@screenbase/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@screenbase/ui/components/ui/table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
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

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
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
            <RecordingRow key={recording.id} recording={recording} />
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
    </div>
  );
}
