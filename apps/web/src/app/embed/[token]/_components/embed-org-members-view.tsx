"use client";

import { useState } from "react";
import type { EmbedMetadata } from "../_lib/types";
import { EmbedPlayer } from "./embed-player";

type Props = {
  token: string;
  metadata: EmbedMetadata;
};

/**
 * org_members 共有の埋め込みビュー。
 *
 * authClient.useSession() による事前セッションチェックは行わない。
 * 理由: Notion 等のサードパーティ iframe では sandbox 属性や
 * SameSite=Lax Cookie の制約でセッションチェックが失敗/ハングする。
 *
 * 代わりにダッシュボードと同じアプローチを取る:
 * 1. プレーヤーを即座にレンダリングし、動画読み込みを開始
 * 2. ストリームリクエストが成功すれば動画が再生される
 * 3. 認証失敗（404）で動画が読み込めなければログイン誘導を表示
 */
export function EmbedOrgMembersView({ token, metadata }: Props) {
  const [accessDenied, setAccessDenied] = useState(false);

  if (accessDenied) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-medium text-white">{metadata.recordingTitle}</p>
        <p className="text-sm text-white/60">
          この動画を閲覧するにはログインが必要です
        </p>
        <a
          href="/sign-in"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-white px-4 py-2 font-medium text-black text-sm hover:bg-white/90"
        >
          ログインして閲覧する
        </a>
      </div>
    );
  }

  return (
    <EmbedPlayer
      token={token}
      mimeType={metadata.mimeType}
      onAccessDenied={() => setAccessDenied(true)}
    />
  );
}
