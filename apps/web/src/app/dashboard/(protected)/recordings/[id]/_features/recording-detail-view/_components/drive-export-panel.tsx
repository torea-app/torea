"use client";

import { Button, buttonVariants } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { Progress } from "@torea/ui/components/ui/progress";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderIcon,
  UploadCloudIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { DriveExport } from "../../../_lib/types";

type Props = {
  recordingId: string;
  initialExports: DriveExport[];
  driveConnected: boolean;
  recordingStatus: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_REVOKED:
    "Google Drive の認可が失効しています。設定画面から再連携してください。",
  INSUFFICIENT_QUOTA:
    "Google Drive の容量が不足しています。空き容量を確保してから再試行してください。",
  RATE_LIMITED:
    "Google Drive のレート制限です。少し時間をおいてから再試行してください。",
  FILE_TOO_LARGE: "ファイルが大きすぎます (5GB 上限)。",
  NETWORK_ERROR: "ネットワークエラーで送信に失敗しました。",
  UNKNOWN: "予期しないエラーが発生しました。",
};

const POLL_INTERVAL_MS = 3000;

export function DriveExportPanel({
  recordingId,
  initialExports,
  driveConnected,
  recordingStatus,
}: Props) {
  const [exports, setExports] = useState<DriveExport[]>(initialExports);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.api.recordings[":id"]["drive-export"].$get({
      param: { id: recordingId },
    });
    if (res.ok) {
      const data = await res.json();
      setExports(data.exports);
    }
  }, [recordingId]);

  const inProgress = exports.some(
    (e) => e.status === "queued" || e.status === "uploading",
  );

  useEffect(() => {
    if (!inProgress) return;
    const t = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [inProgress, refresh]);

  const startExport = async () => {
    setBusy(true);
    try {
      const res = await api.api.recordings[":id"]["drive-export"].$post({
        param: { id: recordingId },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        toast.error("Drive への送信を開始できませんでした", {
          description: err.error ?? "もう一度お試しください。",
        });
        return;
      }
      toast.success("Google Drive への送信を開始しました");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!driveConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloudIcon className="size-4" />
            Google Drive に保存
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Drive 連携が未設定です。連携すると録画と文字起こしを Drive
            に保存できます。
          </p>
          <Link
            href={"/dashboard/settings/integrations" as "/dashboard"}
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            連携設定を開く
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (recordingStatus !== "completed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloudIcon className="size-4" />
            Google Drive に保存
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            録画の処理が完了したら保存できます。
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasFailed = exports.some((e) => e.status === "failed");
  const retryLabel = hasFailed ? "再試行" : "もう一度送信";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloudIcon className="size-4" />
          Google Drive に保存
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {exports.length === 0 ? (
          <Button onClick={startExport} disabled={busy} size="sm">
            Drive に保存
          </Button>
        ) : (
          <>
            <ul className="space-y-2">
              {exports.map((e) => (
                <li key={e.kind} className="rounded-md border p-3 text-sm">
                  <ExportRow exp={e} />
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              onClick={startExport}
              disabled={busy || inProgress}
            >
              {retryLabel}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ExportRow({ exp }: { exp: DriveExport }) {
  const label = exp.kind === "video" ? "動画" : "文字起こし";

  if (exp.status === "completed" && exp.driveWebViewLink) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2Icon className="size-4" /> {label}
        </span>
        <a
          href={exp.driveWebViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm underline"
        >
          Drive で開く <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    );
  }

  if (exp.status === "failed") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircleIcon className="size-4" /> {label}: 失敗
        </div>
        <p className="text-muted-foreground text-xs">
          {ERROR_MESSAGES[exp.errorCode ?? "UNKNOWN"] ??
            exp.errorMessage ??
            ERROR_MESSAGES.UNKNOWN}
        </p>
      </div>
    );
  }

  if (exp.status === "uploading") {
    const pct =
      exp.bytesTotal && exp.bytesTotal > 0
        ? Math.min(100, Math.round((exp.bytesUploaded / exp.bytesTotal) * 100))
        : 0;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <LoaderIcon className="size-4 animate-spin" /> {label}{" "}
            アップロード中
          </span>
          <span className="text-muted-foreground text-xs">{pct}%</span>
        </div>
        <Progress value={pct} />
      </div>
    );
  }

  // queued
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <LoaderIcon className="size-4 animate-spin" /> {label} キュー待機中
    </div>
  );
}
