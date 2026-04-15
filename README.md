# ScreenBase

ブラウザタブの画面録画・共有プラットフォーム。Chrome 拡張機能でタブの映像・音声（マイク含む）を録画し、クラウドへリアルタイムアップロード。Web ダッシュボードで録画の再生・管理ができる。

## 主な機能

- **タブ録画** — Chrome 拡張から 1 クリックで録画開始（カウントダウン付き）
- **リアルタイムアップロード** — 録画中に R2 へマルチパートアップロード（録画終了後の待ち時間なし）
- **オーディオミキシング** — タブ音声 + マイク音声を Web Audio API で合成
- **録画管理** — Web ダッシュボードで一覧表示・再生・削除
- **組織・チーム** — マルチテナント対応、メンバー招待

## 技術スタック

| レイヤー | 技術 |
| --- | --- |
| **モノレポ** | pnpm workspaces + Turborepo |
| **Web** | Next.js 16, React 19, Tailwind CSS 4 |
| **API** | Hono (Cloudflare Workers) |
| **Chrome 拡張** | WXT (Manifest V3), React, Offscreen Document + MediaRecorder |
| **DB** | Cloudflare D1 (SQLite) + Drizzle ORM |
| **ストレージ** | Cloudflare R2 (マルチパートアップロード) |
| **認証** | better-auth (組織プラグイン) |
| **インフラ** | Alchemy (Cloudflare Workers, D1, R2, KV) |
| **UI** | shadcn/ui, Lucide Icons, media-chrome |

## プロジェクト構成

```txt
apps/
  extension/   — Chrome 拡張機能（WXT + React）
  server/      — Hono API サーバー（Cloudflare Workers）
  web/         — Next.js ダッシュボード（@opennextjs/cloudflare でデプロイ）
packages/
  auth/        — better-auth 設定
  db/          — Drizzle スキーマ・マイグレーション
  env/         — 環境変数バリデーション
  infra/       — Alchemy インフラ定義
  ui/          — 共有 UI コンポーネント
```
