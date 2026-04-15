"use client";

import { env } from "@screenbase/env/web";
import { useEffect, useRef } from "react";

type Props = {
  recordingId: string;
  mimeType: string;
  hasThumbnail: boolean;
};

export function ThumbnailGenerator({
  recordingId,
  mimeType,
  hasThumbnail,
}: Props) {
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    if (hasThumbnail || hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    captureThumbnail(recordingId, mimeType);
  }, [recordingId, mimeType, hasThumbnail]);

  return null;
}

async function captureThumbnail(
  recordingId: string,
  mimeType: string,
): Promise<void> {
  try {
    const video = document.createElement("video");
    video.crossOrigin = "use-credentials";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const streamUrl = `${env.NEXT_PUBLIC_SERVER_URL}/api/recordings/${recordingId}/stream`;
    const source = document.createElement("source");
    source.src = streamUrl;
    source.type = mimeType;
    video.appendChild(source);

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Video load failed"));
      video.load();
    });

    video.currentTime = 0.1;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", 0.8);
    });
    if (!blob) return;

    await fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/recordings/${recordingId}/thumbnail`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "image/webp" },
        body: blob,
      },
    );

    video.removeChild(source);
  } catch {
    // サムネイル生成の失敗は無視（次回ページ訪問時に再試行）
  }
}
