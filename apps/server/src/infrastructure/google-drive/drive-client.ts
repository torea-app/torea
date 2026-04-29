/**
 * Google Drive REST API クライアント (v3)。
 *
 * resumable upload は POST でセッションを取得 → PUT で本体送信の 2-step。
 * R2 の `R2ObjectBody.body` (ReadableStream) を fetch の body に渡すと
 * Cloudflare Workers がストリーム転送してくれるため、ファイル全体をメモリに
 * 載せずに数 GB の動画を送信できる。
 *
 * @see https://developers.google.com/workspace/drive/api/guides/manage-uploads
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = {
  id: string;
  name?: string;
  webViewLink?: string;
  parents?: string[];
};

type FileSearchResponse = {
  files: Array<{ id: string; name: string }>;
};

export class DriveApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly googleReason: string | undefined,
    /** Response body (先頭 500 文字に切り詰め済み)。トークンを含まないため安全。 */
    public readonly bodySnippet: string,
  ) {
    super(`Drive API ${status} ${googleReason ?? ""}`);
    this.name = "DriveApiError";
  }
}

export type DriveClient = ReturnType<typeof createDriveClient>;

export function createDriveClient(getAccessToken: () => Promise<string>) {
  async function authedFetch(
    url: string,
    init: RequestInit & { allow404?: boolean } = {},
  ): Promise<Response> {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(url, { ...init, headers });
    if (!res.ok && (res.status !== 404 || !init.allow404)) {
      const body = await res.text();
      throw new DriveApiError(
        res.status,
        parseGoogleErrorReason(body),
        body.slice(0, 500),
      );
    }
    return res;
  }

  return {
    async findFolder(params: {
      name: string;
      parentId?: string;
    }): Promise<string | null> {
      const qParts = [
        `name='${escapeQ(params.name)}'`,
        `mimeType='${FOLDER_MIME}'`,
        "trashed=false",
      ];
      if (params.parentId) qParts.push(`'${params.parentId}' in parents`);
      const url = new URL("https://www.googleapis.com/drive/v3/files");
      url.searchParams.set("q", qParts.join(" and "));
      url.searchParams.set("fields", "files(id,name)");
      url.searchParams.set("pageSize", "1");
      const res = await authedFetch(url.toString());
      const json = await res.json<FileSearchResponse>();
      return json.files[0]?.id ?? null;
    },

    async createFolder(params: {
      name: string;
      parentId?: string;
    }): Promise<string> {
      const res = await authedFetch(
        "https://www.googleapis.com/drive/v3/files?fields=id",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: params.name,
            mimeType: FOLDER_MIME,
            parents: params.parentId ? [params.parentId] : undefined,
          }),
        },
      );
      const json = await res.json<{ id: string }>();
      return json.id;
    },

    async findOrCreateFolder(params: {
      name: string;
      parentId?: string;
    }): Promise<string> {
      const existing = await this.findFolder(params);
      if (existing) return existing;
      return this.createFolder(params);
    },

    /** resumable upload session URI を取得する */
    async createResumableUploadSession(params: {
      name: string;
      parentId: string;
      mimeType: string;
      contentLength: number;
    }): Promise<string> {
      const res = await authedFetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": params.mimeType,
            "X-Upload-Content-Length": String(params.contentLength),
          },
          body: JSON.stringify({
            name: params.name,
            parents: [params.parentId],
            mimeType: params.mimeType,
          }),
        },
      );
      const location = res.headers.get("Location");
      if (!location) {
        throw new Error("Drive resumable session: missing Location header");
      }
      return location;
    },

    /**
     * Upload session URI に PUT で本体を送信し、完了レスポンス JSON を返す。
     *
     * 注: session URI は短命の署名付き URL なので Authorization ヘッダ不要 (Drive 側の仕様)。
     * 本体は ReadableStream を直接渡してストリーム転送する。
     */
    async putUploadBody(params: {
      sessionUri: string;
      body: ReadableStream;
      contentType: string;
      contentLength: number;
    }): Promise<DriveFile> {
      const res = await fetch(params.sessionUri, {
        method: "PUT",
        headers: {
          "Content-Type": params.contentType,
          "Content-Length": String(params.contentLength),
        },
        body: params.body,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new DriveApiError(
          res.status,
          parseGoogleErrorReason(body),
          body.slice(0, 500),
        );
      }
      return res.json<DriveFile>();
    },

    /**
     * 小さいテキストを multipart で 1 リクエスト送信する。
     * transcript (~数 KB) など resumable のセッション往復が無駄になるサイズに使用。
     */
    async uploadSmallText(params: {
      name: string;
      parentId: string;
      mimeType: string;
      text: string;
    }): Promise<DriveFile> {
      const boundary = `bnd_${crypto.randomUUID()}`;
      const meta = JSON.stringify({
        name: params.name,
        parents: [params.parentId],
        mimeType: params.mimeType,
      });
      const body =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${params.mimeType}\r\n\r\n${params.text}\r\n` +
        `--${boundary}--`;
      const res = await authedFetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        {
          method: "POST",
          headers: {
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      return res.json<DriveFile>();
    },

    async deleteFile(fileId: string): Promise<void> {
      await authedFetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE", allow404: true },
      );
    },
  };
}

/** Drive search query で使う名前のエスケープ (シングルクオートとバックスラッシュ)。 */
function escapeQ(s: string): string {
  return s.replace(/['\\]/g, (m) => `\\${m}`);
}

function parseGoogleErrorReason(body: string): string | undefined {
  try {
    const j = JSON.parse(body) as {
      error?: { errors?: { reason?: string }[] };
    };
    return j.error?.errors?.[0]?.reason;
  } catch {
    return undefined;
  }
}
