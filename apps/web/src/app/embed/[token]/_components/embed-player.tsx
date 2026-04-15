"use client";

import { env } from "@screenbase/env/web";
import { LoaderCircleIcon } from "lucide-react";
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const embedMediaVariables = {
  "--media-primary-color": "#fff",
  "--media-secondary-color": "#000",
  "--media-text-color": "#fff",
  "--media-background-color": "#000",
  "--media-control-hover-background": "rgba(255, 255, 255, 0.1)",
  "--media-font-family": "system-ui, sans-serif",
  "--media-range-track-background": "rgba(255, 255, 255, 0.3)",
} as CSSProperties;

type Props = {
  token: string;
  mimeType: string;
  /** ストリームの認証失敗時（動画読み込みエラー時）に呼ばれるコールバック */
  onAccessDenied?: () => void;
};

export function EmbedPlayer({ token, mimeType, onAccessDenied }: Props) {
  const videoUrl = `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/stream`;
  const hasTrackedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // クライアントマウント後に動画ソースを設定する。
  // SSR 時に <source src> を出力すると、ページロード時に即座にリクエストが始まり
  // 大きなファイル（1GB+）ではタブのローディング状態が長時間続く。
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsLoading(true);

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
    onAccessDenied?.();
  }, [onAccessDenied]);

  /**
   * 動画再生開始時に視聴イベントを記録する。
   *
   * - 1 ページロードあたり 1 回のみ呼び出す（useRef で制御）
   * - API 呼び出しの成否に関わらず動画再生は継続する（fire-and-forget）
   * - credentials: "include" で sb_vid Cookie と share_access Cookie を送信
   */
  function handlePlay() {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/views`,
      {
        method: "POST",
        credentials: "include",
      },
    ).catch(() => {
      // 視聴トラッキングの失敗は無視（動画再生に影響させない）
    });
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <LoaderCircleIcon className="size-8 animate-spin text-white/40" />
        </div>
      )}

      <MediaController style={embedMediaVariables} className="h-full w-full">
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
          onPlay={handlePlay}
        />
        <MediaControlBar>
          <MediaPlayButton className="p-2.5" />
          <MediaTimeRange className="p-2.5" />
          <MediaTimeDisplay className="p-2.5" showDuration />
          <MediaMuteButton className="p-2.5" />
          <MediaVolumeRange className="p-2.5" />
          <MediaFullscreenButton className="p-2.5" />
        </MediaControlBar>
      </MediaController>
    </div>
  );
}
