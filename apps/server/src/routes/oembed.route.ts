import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createShareRepository } from "../infrastructure/repositories/share.repository";
import type { AppEnv } from "../types";
import { oembedQuerySchema } from "./oembed.schemas";

export const oembedRoute = new Hono<AppEnv>().get(
  "/",
  zValidator("query", oembedQuerySchema),
  async (c) => {
    const { url, maxwidth, maxheight } = c.req.valid("query");

    // URL から共有トークンを抽出
    let token: string;
    try {
      const urlObj = new URL(url);
      const match = urlObj.pathname.match(/^\/share\/([^/]+)$/);
      if (!match) {
        return c.json({ error: "Invalid URL format" }, 404);
      }
      token = decodeURIComponent(match[1] as string);
    } catch {
      return c.json({ error: "Invalid URL" }, 404);
    }

    // 共有リンクの取得
    const shareRepo = createShareRepository(c.env.DB);
    const shareLink = await shareRepo.findByToken(token);
    if (!shareLink) {
      return c.json({ error: "Not found" }, 404);
    }

    // 録画メタデータの取得
    const recordingRepo = createRecordingRepository(c.env.DB);
    const recording = await recordingRepo.findById(
      shareLink.recordingId,
      shareLink.organizationId,
    );
    if (!recording || recording.status !== "completed") {
      return c.json({ error: "Not found" }, 404);
    }

    // レスポンスサイズの計算
    const defaultWidth = 640;
    const defaultHeight = 360;
    let width = defaultWidth;
    let height = defaultHeight;

    if (maxwidth && maxwidth < width) {
      const ratio = maxwidth / width;
      width = maxwidth;
      height = Math.round(height * ratio);
    }
    if (maxheight && maxheight < height) {
      const ratio = maxheight / height;
      height = maxheight;
      width = Math.round(width * ratio);
    }

    // 埋め込み URL の生成
    const originUrl = new URL(url);
    const embedUrl = `${originUrl.origin}/embed/${encodeURIComponent(token)}`;

    const response: Record<string, unknown> = {
      version: "1.0",
      type: "video",
      title: recording.title,
      provider_name: "ScreenBase",
      provider_url: originUrl.origin,
      width,
      height,
      html: `<iframe src="${embedUrl}" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`,
    };

    if (recording.thumbnailR2Key) {
      const serverOrigin = new URL(c.req.url).origin;
      response.thumbnail_url = `${serverOrigin}/api/share/${encodeURIComponent(token)}/thumbnail`;
      response.thumbnail_width = width;
      response.thumbnail_height = height;
    }

    return c.json(response);
  },
);
