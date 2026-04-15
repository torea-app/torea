import type { ShareLinkType } from "../../domain/types/share";
import type { createRecordingRepository } from "../../infrastructure/repositories/recording.repository";
import type { createShareRepository } from "../../infrastructure/repositories/share.repository";

/**
 * PBKDF2-SHA256 でパスワードをハッシュ化する。
 * Web Crypto API（グローバル）を使用するため、Cloudflare Workers で動作する。
 * 返り値は hex 文字列（64 文字）。
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

type Deps = {
  repo: ReturnType<typeof createShareRepository>;
  recordingRepo: ReturnType<typeof createRecordingRepository>;
  generateId: () => string;
};

export function createShareService({ repo, recordingRepo, generateId }: Deps) {
  return {
    /**
     * 共有リンクを作成する。
     * - org_members: パスワード不要
     * - password_protected: パスワード必須（PBKDF2 でハッシュ化して保存）
     * 録画が存在しない場合または自組織のものでない場合は null を返す。
     */
    async createShareLink(params: {
      organizationId: string;
      createdByUserId: string;
      recordingId: string;
      type: ShareLinkType;
      password?: string;
    }) {
      // 録画の存在確認（組織スコープ）
      const recording = await recordingRepo.findById(
        params.recordingId,
        params.organizationId,
      );
      if (!recording) {
        return null;
      }

      // password_protected の場合はパスワードをハッシュ化
      let passwordHash: string | null = null;
      let passwordSalt: string | null = null;
      if (params.type === "password_protected") {
        if (!params.password || params.password.trim().length === 0) {
          throw new Error("Password is required for password_protected type");
        }
        passwordSalt = crypto.randomUUID();
        passwordHash = await hashPassword(params.password, passwordSalt);
      }

      const id = generateId();
      return repo.create({
        id,
        organizationId: params.organizationId,
        createdByUserId: params.createdByUserId,
        recordingId: params.recordingId,
        type: params.type,
        passwordHash,
        passwordSalt,
      });
    },

    /**
     * 録画に紐づく共有リンク一覧を取得する。
     * organizationId スコープで自組織のリンクのみ返す。
     */
    async listShareLinks(params: {
      organizationId: string;
      recordingId: string;
    }) {
      return repo.findByRecording(params.recordingId, params.organizationId);
    },

    /**
     * 共有リンクを削除する。
     * 見つからない（または自組織でない）場合は false を返す。
     */
    async deleteShareLink(params: { organizationId: string; shareId: string }) {
      return repo.delete(params.shareId, params.organizationId);
    },
  };
}
