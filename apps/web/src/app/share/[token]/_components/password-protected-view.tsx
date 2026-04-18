"use client";

import { env } from "@torea/env/web";
import { Button } from "@torea/ui/components/ui/button";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { Separator } from "@torea/ui/components/ui/separator";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import type { ShareMetadata } from "../_lib/types";
import { ShareRecordingInfo } from "./share-recording-info";
import { ShareVideoPlayer } from "./share-video-player";

type Props = {
  token: string;
  metadata: ShareMetadata;
};

export function PasswordProtectedView({ token, metadata }: Props) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/verify`,
        {
          method: "POST",
          credentials: "include", // Cookie 受け取りに必須
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );

      if (res.ok) {
        setIsUnlocked(true);
      } else {
        setError("パスワードが正しくありません");
      }
    } catch {
      setError("エラーが発生しました。もう一度お試しください");
    } finally {
      setIsVerifying(false);
    }
  }

  // パスワード認証済み: 動画プレーヤーを表示
  if (isUnlocked) {
    return (
      <div className="space-y-6">
        <ShareVideoPlayer token={token} mimeType={metadata.mimeType} />
        <Separator />
        <ShareRecordingInfo metadata={metadata} />
      </div>
    );
  }

  // パスワード入力フォーム
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <LockIcon className="size-6 text-muted-foreground" />
          </div>
          <h1 className="font-semibold text-xl">{metadata.recordingTitle}</h1>
          <p className="text-muted-foreground text-sm">
            この動画はパスワードで保護されています
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <Button type="submit" disabled={isVerifying} className="w-full">
            {isVerifying ? "確認中..." : "確認する"}
          </Button>
        </form>
      </div>
    </div>
  );
}
