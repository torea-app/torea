"use client";

import { env } from "@torea/env/web";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import type { EmbedMetadata } from "../_lib/types";
import { EmbedPlayer } from "./embed-player";

type Props = {
  token: string;
  metadata: EmbedMetadata;
};

export function EmbedPasswordView({ token, metadata }: Props) {
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
          credentials: "include",
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

  if (isUnlocked) {
    return <EmbedPlayer token={token} mimeType={metadata.mimeType} />;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
        <LockIcon className="size-6 text-white/60" />
      </div>
      <p className="font-medium text-white">{metadata.recordingTitle}</p>
      <p className="text-sm text-white/60">
        この動画はパスワードで保護されています
      </p>
      <form onSubmit={handleVerify} className="flex w-full max-w-xs gap-2">
        <input
          type="password"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={isVerifying || !password.trim()}
          className="rounded-md bg-white px-4 py-2 font-medium text-black text-sm hover:bg-white/90 disabled:opacity-50"
        >
          {isVerifying ? "..." : "確認"}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
