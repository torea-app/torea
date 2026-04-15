"use client";

import { env } from "@screenbase/env/web";
import { LoaderCircleIcon } from "lucide-react";
import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CommentThread } from "../../../../_lib/types";
import { TimelineMarkers } from "./timeline-markers";

const mediaVariables = {
  "--media-primary-color": "var(--primary)",
  "--media-secondary-color": "var(--background)",
  "--media-text-color": "var(--foreground)",
  "--media-background-color": "var(--background)",
  "--media-control-hover-background": "var(--accent)",
  "--media-font-family": "var(--font-sans)",
  "--media-live-button-icon-color": "var(--muted-foreground)",
  "--media-live-button-indicator-color": "var(--destructive)",
  "--media-range-track-background": "var(--border)",
} as CSSProperties;

export type VideoPlayerHandle = {
  seekTo: (ms: number) => void;
  getCurrentTimeMs: () => number;
};

type Props = {
  recordingId: string;
  mimeType: string;
  durationMs?: number | null;
  comments?: CommentThread[];
  onSeek?: (ms: number) => void;
};

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(
  function VideoPlayer(
    { recordingId, mimeType, durationMs, comments, onSeek },
    ref,
  ) {
    const videoUrl = `${env.NEXT_PUBLIC_SERVER_URL}/api/recordings/${recordingId}/stream`;
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (ms: number) => {
        const video = videoRef.current;
        if (video) {
          video.currentTime = ms / 1000;
        }
      },
      getCurrentTimeMs: () => {
        const video = videoRef.current;
        return video ? Math.floor(video.currentTime * 1000) : 0;
      },
    }));

    // クライアントマウント後に動画ソースを設定する。
    // SSR 時に <source src> を出力すると、ページロード時に即座にリクエストが始まり
    // 大きなファイル（1GB+）ではタブのローディング状態が長時間続く。
    // useEffect 内で src を設定することでページロードと動画読み込みを分離する。
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      setIsLoading(true);

      // <source> 要素を動的に追加して type ヒントを渡す。
      // type を指定することでブラウザが非対応フォーマットを即座にスキップできる。
      const source = document.createElement("source");
      source.src = videoUrl;
      source.type = mimeType;
      video.appendChild(source);
      video.load();

      return () => {
        video.removeChild(source);
      };
    }, [videoUrl, mimeType]);

    const handleLoadedMetadata = useCallback(() => {
      setIsLoading(false);
    }, []);

    const handleError = useCallback(() => {
      setIsLoading(false);
    }, []);

    return (
      <div className="relative overflow-hidden rounded-lg border">
        {/* メタデータ読み込み中のオーバーレイ */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/80">
            <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              動画を読み込んでいます...
            </p>
          </div>
        )}

        <MediaController style={mediaVariables} className="aspect-video w-full">
          {/* biome-ignore lint/a11y/useMediaCaption: screen recordings don't have captions */}
          <video
            ref={videoRef}
            slot="media"
            preload="metadata"
            crossOrigin="use-credentials"
            playsInline
            className="mt-0 mb-0"
            tabIndex={-1}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
          />
          <MediaControlBar>
            <MediaPlayButton className="p-2.5" />
            <MediaSeekBackwardButton className="p-2.5" />
            <MediaSeekForwardButton className="p-2.5" />
            <MediaTimeRange className="p-2.5" />
            <MediaTimeDisplay className="p-2.5" showDuration />
            <MediaMuteButton className="p-2.5" />
            <MediaVolumeRange className="p-2.5" />
          </MediaControlBar>
        </MediaController>

        {/* タイムラインマーカー（コントロールバーの上に重ねる） */}
        {comments && comments.length > 0 && durationMs && onSeek && (
          <TimelineMarkers
            comments={comments}
            durationMs={durationMs}
            onSeek={onSeek}
          />
        )}
      </div>
    );
  },
);
