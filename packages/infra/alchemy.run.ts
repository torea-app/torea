// ローカル開発時: Miniflare プロキシでクライアント切断時に発生する
// AbortError の unhandled エラーによるクラッシュを防止する
process.on("uncaughtException", (err) => {
  if (err instanceof DOMException && err.name === "AbortError") return;
  console.error("Uncaught exception:", err);
  process.exit(1);
});

import alchemy from "alchemy";
import {
	D1Database,
	KVNamespace,
	Nextjs,
	Queue,
	R2Bucket,
	Worker,
} from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

// ローカル開発時のみ .env.local を読み込む。
// 全ての環境変数はルートの .env.local に一元管理。
// CI/CD (ALCHEMY_DEPLOY=1) では GitHub Actions の env から供給される。
if (!process.env.ALCHEMY_DEPLOY) {
  config({ path: "../../.env.local" });
}

// USE_REMOTE_BINDINGS=true でローカル開発時もリモートの D1/R2/KV/Queue を使用
const useRemoteBindings = process.env.USE_REMOTE_BINDINGS === "true";

const app = await alchemy("torea", {
  stage: process.env.ALCHEMY_STAGE ?? "dev",
  password: process.env.ALCHEMY_PASSWORD,
  // deploy/CI ではリモート state、dev ではローカルファイルシステム state
  ...(process.env.ALCHEMY_DEPLOY
    ? {
        stateStore: (scope) =>
          new CloudflareStateStore(scope, {
            scriptName: "torea-alchemy-state",
            forceUpdate: true,
          }),
      }
    : {}),
});

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const r2 = await R2Bucket("torea-storage", {
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const kv = await KVNamespace("torea-kv", {
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const videoProcessingQueue = await Queue("video-processing-queue", {
  name: "torea-video-processing",
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const transcriptionQueue = await Queue("transcription-queue", {
  name: "torea-transcription",
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const webhookDeliveryQueue = await Queue("webhook-delivery-queue", {
  name: "torea-webhook-delivery",
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

const webhookSecretKv = await KVNamespace("torea-webhook-secrets", {
  ...(useRemoteBindings ? { dev: { remote: true } } : {}),
});

export const web = await Nextjs("web", {
  cwd: "../../apps/web",
  domains: ["torea.app"],
  bindings: {
    NEXT_PUBLIC_SERVER_URL: alchemy.env.NEXT_PUBLIC_SERVER_URL!,
    NEXT_PUBLIC_APP_URL: alchemy.env.NEXT_PUBLIC_APP_URL!,
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    COOKIE_DOMAIN: alchemy.env.COOKIE_DOMAIN!,
  },
  dev: {
    command: "pnpm next dev --webpack --port 3001",
    domain: "localhost:3001",
  },
});

export const server = await Worker("server", {
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  domains: ["api.torea.app"],
  bindings: {
    DB: db,
    R2: r2,
    KV: kv,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    RESEND_API_KEY: alchemy.secret.env.RESEND_API_KEY!,
    FROM_EMAIL: alchemy.env.FROM_EMAIL!,
    COOKIE_DOMAIN: alchemy.env.COOKIE_DOMAIN!,
    VIDEO_PROCESSING_QUEUE: videoProcessingQueue,
    TRANSCRIPTION_QUEUE: transcriptionQueue,
    WEBHOOK_DELIVERY_QUEUE: webhookDeliveryQueue,
    WEBHOOK_SECRET_KV: webhookSecretKv,
    // AWS Lambda（動画変換処理）
    LAMBDA_FUNCTION_URL: alchemy.env.LAMBDA_FUNCTION_URL!,
    LAMBDA_REGION: alchemy.env.LAMBDA_REGION!,
    AWS_ACCESS_KEY_ID: alchemy.secret.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: alchemy.secret.env.AWS_SECRET_ACCESS_KEY!,
    // ローカル開発時は必ず true（Lambda を呼ばない）。
    // 本番デプロイ時のみ env var を参照し、未設定なら空文字（= 変換を実行）。
    SKIP_VIDEO_PROCESSING: process.env.ALCHEMY_DEPLOY
      ? (process.env.SKIP_VIDEO_PROCESSING ?? "")
      : "true",
    // ローカル開発時は必ず true（文字起こしをスキップ）。
    // 本番デプロイ時のみ env var を参照し、未設定なら空文字（= 文字起こしを実行）。
    SKIP_TRANSCRIPTION: process.env.ALCHEMY_DEPLOY
      ? (process.env.SKIP_TRANSCRIPTION ?? "")
      : "true",
  },
  eventSources: [
    { queue: videoProcessingQueue, settings: { maxRetries: 3, batchSize: 1 } },
    { queue: transcriptionQueue, settings: { maxRetries: 3, batchSize: 1 } },
    // Webhook 配信はランナー内で DB 状態と連動した指数バックオフで再送制御するため、
    // Queue の auto-retry は最小限 (0) にして重複配信を防止する。
    {
      queue: webhookDeliveryQueue,
      settings: { maxRetries: 0, batchSize: 10 },
    },
  ],
  // 10 分間隔で webhook delivery のセーフティネット Cron を実行
  // (Queue ロスト / デプロイ取りこぼしを救済)
  crons: ["*/10 * * * *"],
  dev: {
    port: 3000,
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
