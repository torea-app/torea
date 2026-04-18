"use client";

import { buttonVariants } from "@torea/ui/components/ui/button";
import { Separator } from "@torea/ui/components/ui/separator";
import Link from "next/link";
import { useRef } from "react";
import { authClient } from "@/lib/auth-client";
import type { ShareMetadata } from "../_lib/types";
import { ShareCommentSection } from "./share-comment-section";
import { ShareRecordingInfo } from "./share-recording-info";
import {
  ShareVideoPlayer,
  type ShareVideoPlayerHandle,
} from "./share-video-player";

type Props = {
  token: string;
  metadata: ShareMetadata;
};

export function OrgMembersView({ token, metadata }: Props) {
  const { data: session, isPending } = authClient.useSession();
  const playerRef = useRef<ShareVideoPlayerHandle>(null);

  if (isPending) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/50">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

  // 未ログインの場合: ログイン誘導
  if (!session) {
    return (
      <div className="space-y-6">
        <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/50">
          <p className="font-medium text-foreground">
            {metadata.recordingTitle}
          </p>
          <p className="text-muted-foreground text-sm">
            この動画を閲覧するにはログインが必要です
          </p>
          <Link href="/sign-in" className={buttonVariants()}>
            ログインして閲覧する
          </Link>
        </div>
      </div>
    );
  }

  // ログイン済みの場合: 動画プレーヤーとコメントセクションを表示
  return (
    <div className="space-y-6">
      <ShareVideoPlayer
        ref={playerRef}
        token={token}
        mimeType={metadata.mimeType}
      />
      <Separator />
      <ShareRecordingInfo metadata={metadata} />
      <ShareCommentSection
        token={token}
        playerRef={playerRef}
        durationMs={metadata.durationMs}
      />
    </div>
  );
}
