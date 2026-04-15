import { zValidator } from "@hono/zod-validator";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { createCommentRepository } from "../infrastructure/repositories/comment.repository";
import { createOrganizationRepository } from "../infrastructure/repositories/organization.repository";
import { createRecordingRepository } from "../infrastructure/repositories/recording.repository";
import { createShareRepository } from "../infrastructure/repositories/share.repository";
import { createViewEventRepository } from "../infrastructure/repositories/view-event.repository";
import { R2StorageClient } from "../infrastructure/storage/r2-client";
import { getSessionFromRequest } from "../middleware/auth";
import type { AppEnv } from "../types";
import { createCommentService } from "../use-cases/comment/comment.service";
import { createViewAnalyticsService } from "../use-cases/view-analytics/view-analytics.service";
import { createCommentSchema } from "./comment.schemas";
import {
  shareTokenParamSchema,
  verifyPasswordBodySchema,
} from "./share-access.schemas";

// ---- ファイル内ユーティリティ（外部 export なし） ----

/**
 * アクセストークンを HMAC-SHA256 で署名して生成する。
 * フォーマット: base64(payload) + "." + hex(signature)
 * payload: { shareId, exp } の JSON 文字列
 */
async function createAccessToken(
  shareId: string,
  secret: string,
): Promise<string> {
  const payload = JSON.stringify({
    shareId,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${btoa(payload)}.${sigHex}`;
}

/**
 * アクセストークンを検証する。
 * 署名が不正または有効期限切れの場合は null を返す。
 */
async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<{ shareId: string } | null> {
  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const sigHex = token.slice(dotIdx + 1);

  let payload: string;
  try {
    payload = atob(payloadB64);
  } catch {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = new Uint8Array(
    // biome-ignore lint/style/noNonNullAssertion: hex string split is safe
    sigHex.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)),
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    encoder.encode(payload),
  );
  if (!valid) return null;

  let data: { shareId: string; exp: number };
  try {
    data = JSON.parse(payload) as { shareId: string; exp: number };
  } catch {
    return null;
  }

  if (data.exp < Date.now()) return null;

  return { shareId: data.shareId };
}

/**
 * PBKDF2-SHA256 でパスワードをハッシュ化する（share.service.ts と同一実装）。
 * パスワード検証に使用する。
 */
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: 100_000,
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ACCESS_COOKIE_NAME = (shareId: string) => `share_access_${shareId}`;
const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 時間

// ---- sb_vid（匿名ビジター識別 Cookie） ----

const VISITOR_COOKIE_NAME = "sb_vid";
const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 年（秒）

/**
 * UUID v4 フォーマットの検証用正規表現。
 * sb_vid Cookie の値を検証し、不正な値の注入を防止する。
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * リクエストから sb_vid Cookie を読み取る。
 * Cookie が存在しない or フォーマットが不正な場合は null を返す。
 */
function getVisitorIdFromCookie(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)sb_vid=([0-9a-f-]{36})/i);
  const value = match?.[1];
  if (!value || !UUID_V4_REGEX.test(value)) {
    return null;
  }
  return value;
}

/**
 * sb_vid Cookie を設定する Set-Cookie ヘッダー値を生成する。
 *
 * - HttpOnly: XSS による Cookie 窃取を防止
 * - Secure: HTTPS のみで送信
 * - SameSite=None: Web アプリ（別オリジン）からの API リクエストに Cookie を送信するために必要
 * - Path=/api/share/: 共有 API のみに Cookie を送信（スコープ最小化）
 */
function buildVisitorCookieHeader(visitorId: string): string {
  return [
    `${VISITOR_COOKIE_NAME}=${visitorId}`,
    "HttpOnly",
    "Secure",
    "SameSite=None",
    `Max-Age=${VISITOR_COOKIE_MAX_AGE}`,
    "Path=/api/share/",
  ].join("; ");
}

export const shareAccessRoute = new Hono<AppEnv>()

  // =============================================
  // GET /api/share/:token/thumbnail — サムネイル配信（認証不要）
  // =============================================
  .get("/:token/thumbnail", async (c) => {
    const token = c.req.param("token");

    const shareRepo = createShareRepository(c.env.DB);
    const shareLink = await shareRepo.findByToken(token);
    if (!shareLink) {
      return c.notFound();
    }

    const recordingRepo = createRecordingRepository(c.env.DB);
    const recording = await recordingRepo.findById(
      shareLink.recordingId,
      shareLink.organizationId,
    );
    if (!recording?.thumbnailR2Key) {
      return c.notFound();
    }

    const r2Client = new R2StorageClient(c.env.R2);
    const object = await r2Client.get(recording.thumbnailR2Key);
    if (!object) {
      return c.notFound();
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "image/webp",
        "Cache-Control": "public, max-age=86400, immutable",
        ETag: object.httpEtag,
      },
    });
  })

  // =============================================
  // GET /api/share/:token — 共有メタデータ取得（認証不要）
  // =============================================
  .get("/:token", zValidator("param", shareTokenParamSchema), async (c) => {
    const { token } = c.req.valid("param");

    const repo = createShareRepository(c.env.DB);
    const shareLink = await repo.findByToken(token);

    if (!shareLink) {
      return c.json({ error: "Not found" }, 404);
    }

    const recordingRepo = createRecordingRepository(c.env.DB);
    const recording = await recordingRepo.findById(
      shareLink.recordingId,
      shareLink.organizationId,
    );

    if (!recording || recording.status !== "completed") {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json({
      shareId: shareLink.id,
      type: shareLink.type,
      recordingTitle: recording.title,
      mimeType: recording.mimeType,
      durationMs: recording.durationMs,
    });
  })

  // =============================================
  // POST /api/share/:token/verify — パスワード検証 + Cookie 発行
  // =============================================
  .post(
    "/:token/verify",
    zValidator("param", shareTokenParamSchema),
    zValidator("json", verifyPasswordBodySchema),
    async (c) => {
      const { token } = c.req.valid("param");
      const { password } = c.req.valid("json");

      const repo = createShareRepository(c.env.DB);
      const shareLink = await repo.findByToken(token);

      // 存在しない・type が違う → 404（情報漏洩防止）
      if (!shareLink || shareLink.type !== "password_protected") {
        return c.json({ error: "Not found" }, 404);
      }

      // null guard（type === 'password_protected' なら必ず存在する）
      if (!shareLink.passwordHash || !shareLink.passwordSalt) {
        return c.json({ error: "Not found" }, 404);
      }

      // パスワード検証
      const inputHash = await hashPassword(password, shareLink.passwordSalt);
      const isValid = inputHash === shareLink.passwordHash;

      if (!isValid) {
        return c.json({ error: "Incorrect password" }, 401);
      }

      // HMAC 署名アクセストークン生成
      const accessToken = await createAccessToken(
        shareLink.id,
        c.env.BETTER_AUTH_SECRET,
      );

      // HttpOnly Cookie を設定（24 時間有効）
      // SameSite=None; Secure は Web アプリ（別オリジン）からの動画リクエストに Cookie を送るために必要
      c.header(
        "Set-Cookie",
        [
          `${ACCESS_COOKIE_NAME(shareLink.id)}=${accessToken}`,
          "HttpOnly",
          "Secure",
          "SameSite=None",
          `Max-Age=${ACCESS_COOKIE_MAX_AGE}`,
          "Path=/api/share/",
        ].join("; "),
      );

      return c.json({ success: true });
    },
  )

  // =============================================
  // GET /api/share/:token/stream — 動画ストリーミング（カスタム認証）
  // =============================================
  .get(
    "/:token/stream",
    zValidator("param", shareTokenParamSchema),
    async (c) => {
      const { token } = c.req.valid("param");

      const repo = createShareRepository(c.env.DB);
      const shareLink = await repo.findByToken(token);

      if (!shareLink) {
        return c.json({ error: "Not found" }, 404);
      }

      // ---- アクセス制御 ----
      let hasAccess = false;

      if (shareLink.type === "org_members") {
        // BetterAuth セッションを確認
        const sessionUser = await getSessionFromRequest(c.req.raw.headers);
        if (sessionUser) {
          // 組織メンバーシップを確認（アクティブ組織設定に依存しない）
          const orgRepo = createOrganizationRepository(c.env.DB);
          hasAccess = await orgRepo.isMemberOf(
            sessionUser.userId,
            shareLink.organizationId,
          );
        }
      } else if (shareLink.type === "password_protected") {
        // アクセストークン Cookie を確認
        const cookieName = ACCESS_COOKIE_NAME(shareLink.id);
        const cookieHeader = c.req.header("cookie") ?? "";
        const match = cookieHeader.match(
          new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`),
        );
        const rawToken = match?.[1];

        if (rawToken) {
          const decoded = await verifyAccessToken(
            rawToken,
            c.env.BETTER_AUTH_SECRET,
          );
          hasAccess = decoded?.shareId === shareLink.id;
        }
      }

      if (!hasAccess) {
        // セキュリティ: 403 ではなく 404 で応答
        return c.json({ error: "Not found" }, 404);
      }

      // ---- 録画取得 ----
      const recordingRepo = createRecordingRepository(c.env.DB);
      const recording = await recordingRepo.findById(
        shareLink.recordingId,
        shareLink.organizationId,
      );

      if (!recording || recording.status !== "completed") {
        return c.json({ error: "Not found" }, 404);
      }

      // ---- R2 ストリーミング（HTTP Range 対応） ----
      const storage = new R2StorageClient(c.env.R2);
      const etag = `"${recording.id}"`;

      // If-None-Match: ETag が一致すれば 304 を返す（R2 フェッチをスキップ）
      const ifNoneMatch = c.req.header("if-none-match");
      if (ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control":
              "private, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }

      const rangeHeader = c.req.header("range");
      let parsedStart: number | undefined;
      let parsedEnd: number | undefined;

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match?.[1]) {
          parsedStart = Number.parseInt(match[1], 10);
          parsedEnd = match[2] ? Number.parseInt(match[2], 10) : undefined;
        }
      }

      // R2 Range パラメータを構築（length: undefined を渡さない）
      const r2Range =
        parsedStart !== undefined
          ? parsedEnd !== undefined
            ? { offset: parsedStart, length: parsedEnd - parsedStart + 1 }
            : { offset: parsedStart }
          : undefined;

      const object = r2Range
        ? await storage.getWithRange(recording.r2Key, r2Range)
        : await storage.get(recording.r2Key);

      if (!object) {
        return c.json({ error: "Not found" }, 404);
      }

      const totalSize = object.size;
      const headers = new Headers();
      headers.set("Content-Type", recording.mimeType);
      headers.set("Accept-Ranges", "bytes");
      headers.set("ETag", etag);
      headers.set(
        "Cache-Control",
        "private, max-age=3600, stale-while-revalidate=86400",
      );

      // Range リクエストの場合は常に 206 を返す
      if (r2Range) {
        const rangeStart = r2Range.offset;
        const rangeLength = object.range
          ? (object.range as { length: number }).length
          : parsedEnd !== undefined
            ? parsedEnd - rangeStart + 1
            : totalSize - rangeStart;
        const rangeEnd = rangeStart + rangeLength - 1;

        headers.set(
          "Content-Range",
          `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
        );
        headers.set("Content-Length", String(rangeLength));
        return new Response(object.body, { status: 206, headers });
      }

      headers.set("Content-Length", String(totalSize));
      return new Response(object.body, { status: 200, headers });
    },
  )

  // =============================================
  // POST /api/share/:token/views — 視聴イベント記録
  // =============================================
  .post(
    "/:token/views",
    zValidator("param", shareTokenParamSchema),
    async (c) => {
      const { token } = c.req.valid("param");

      const shareRepo = createShareRepository(c.env.DB);
      const shareLink = await shareRepo.findByToken(token);

      if (!shareLink) {
        return c.json({ error: "Not found" }, 404);
      }

      // ---- アクセス制御（stream エンドポイントと同一ロジック） ----
      let hasAccess = false;
      let viewerUserId: string | null = null;

      if (shareLink.type === "org_members") {
        const sessionUser = await getSessionFromRequest(c.req.raw.headers);
        if (sessionUser) {
          const orgRepo = createOrganizationRepository(c.env.DB);
          hasAccess = await orgRepo.isMemberOf(
            sessionUser.userId,
            shareLink.organizationId,
          );
          if (hasAccess) {
            viewerUserId = sessionUser.userId;
          }
        }
      } else if (shareLink.type === "password_protected") {
        const cookieName = ACCESS_COOKIE_NAME(shareLink.id);
        const cookieHeader = c.req.header("cookie") ?? "";
        const accessMatch = cookieHeader.match(
          new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`),
        );
        const rawToken = accessMatch?.[1];

        if (rawToken) {
          const decoded = await verifyAccessToken(
            rawToken,
            c.env.BETTER_AUTH_SECRET,
          );
          hasAccess = decoded?.shareId === shareLink.id;
        }

        // password_protected でもログインしている可能性がある
        if (hasAccess) {
          const sessionUser = await getSessionFromRequest(c.req.raw.headers);
          if (sessionUser) {
            viewerUserId = sessionUser.userId;
          }
        }
      }

      if (!hasAccess) {
        return c.json({ error: "Not found" }, 404);
      }

      // ---- sb_vid Cookie ハンドリング ----
      const cookieHeader = c.req.header("cookie") ?? "";
      let visitorId = getVisitorIdFromCookie(cookieHeader);
      let isNewVisitor = false;

      // ログインユーザーでない場合のみ visitor_id を使用
      if (!viewerUserId) {
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          isNewVisitor = true;
        }
      } else {
        // ログインユーザーの場合は visitor_id を null にする
        visitorId = null;
      }

      // ---- 視聴イベント記録 ----
      const service = createViewAnalyticsService({
        repo: createViewEventRepository(c.env.DB),
        generateId: createId,
      });

      const stats = await service.recordView({
        recordingId: shareLink.recordingId,
        shareLinkId: shareLink.id,
        viewerUserId,
        visitorId,
      });

      // 新しい visitor の場合のみ Cookie を設定
      if (isNewVisitor && visitorId) {
        c.header("Set-Cookie", buildVisitorCookieHeader(visitorId));
      }

      return c.json(stats);
    },
  )

  // =============================================
  // GET /api/share/:token/comments — 共有ページコメント一覧
  // org_members のみ（ログイン必須）
  // =============================================
  .get(
    "/:token/comments",
    zValidator("param", shareTokenParamSchema),
    async (c) => {
      const { token } = c.req.valid("param");

      const shareRepo = createShareRepository(c.env.DB);
      const shareLink = await shareRepo.findByToken(token);

      if (!shareLink) {
        return c.json({ error: "Not found" }, 404);
      }

      // org_members タイプのみコメント機能を提供
      if (shareLink.type !== "org_members") {
        return c.json({ error: "Comments are not available" }, 403);
      }

      // ログインユーザーの組織メンバーシップを確認
      const sessionUser = await getSessionFromRequest(c.req.raw.headers);
      if (!sessionUser) {
        return c.json({ error: "Authentication required" }, 401);
      }

      const orgRepo = createOrganizationRepository(c.env.DB);
      const isMember = await orgRepo.isMemberOf(
        sessionUser.userId,
        shareLink.organizationId,
      );
      if (!isMember) {
        return c.json({ error: "Not found" }, 404);
      }

      const service = createCommentService({
        repo: createCommentRepository(c.env.DB),
        generateId: createId,
      });

      const comments = await service.listComments(shareLink.recordingId);
      return c.json({ comments });
    },
  )

  // =============================================
  // POST /api/share/:token/comments — 共有ページコメント作成
  // org_members のみ（ログイン必須）
  // =============================================
  .post(
    "/:token/comments",
    zValidator("param", shareTokenParamSchema),
    zValidator("json", createCommentSchema),
    async (c) => {
      const { token } = c.req.valid("param");
      const body = c.req.valid("json");

      const shareRepo = createShareRepository(c.env.DB);
      const shareLink = await shareRepo.findByToken(token);

      if (!shareLink) {
        return c.json({ error: "Not found" }, 404);
      }

      if (shareLink.type !== "org_members") {
        return c.json({ error: "Comments are not available" }, 403);
      }

      const sessionUser = await getSessionFromRequest(c.req.raw.headers);
      if (!sessionUser) {
        return c.json({ error: "Authentication required" }, 401);
      }

      const orgRepo = createOrganizationRepository(c.env.DB);
      const isMember = await orgRepo.isMemberOf(
        sessionUser.userId,
        shareLink.organizationId,
      );
      if (!isMember) {
        return c.json({ error: "Not found" }, 404);
      }

      const service = createCommentService({
        repo: createCommentRepository(c.env.DB),
        generateId: createId,
      });

      try {
        const comments = await service.createComment({
          recordingId: shareLink.recordingId,
          userId: sessionUser.userId,
          body: body.body,
          timestampMs: body.timestampMs,
          parentId: body.parentId,
        });
        return c.json({ comments }, 201);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create comment";
        return c.json({ error: message }, 400);
      }
    },
  );
