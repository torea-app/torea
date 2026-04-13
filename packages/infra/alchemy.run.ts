import alchemy from "alchemy";
import {
	D1Database,
	KVNamespace,
	Nextjs,
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

const app = await alchemy("screenbase", {
  stage: process.env.ALCHEMY_STAGE ?? "dev",
  password: process.env.ALCHEMY_PASSWORD,
  // deploy/CI ではリモート state、dev ではローカルファイルシステム state
  ...(process.env.ALCHEMY_DEPLOY
    ? {
        stateStore: (scope) =>
          new CloudflareStateStore(scope, {
            scriptName: "screenbase-alchemy-state",
            forceUpdate: true,
          }),
      }
    : {}),
});

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
});

const r2 = await R2Bucket("screenbase-storage");

const kv = await KVNamespace("screenbase-kv");

export const web = await Nextjs("web", {
  cwd: "../../apps/web",
  domains: ["screenbase.dpdns.org"],
  bindings: {
    NEXT_PUBLIC_SERVER_URL: alchemy.env.NEXT_PUBLIC_SERVER_URL!,
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
  domains: ["api.screenbase.dpdns.org"],
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
  },
  dev: {
    port: 3000,
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
