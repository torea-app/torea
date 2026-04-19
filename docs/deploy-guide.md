# torea 本番デプロイガイド

Cloudflare Workers + Alchemy を使った本番デプロイの手順です。
ドメイン `torea.app` は Cloudflare に登録済みの前提で進めます。

Lambda 関数（動画変換 + 文字起こし）のデプロイは [Lambda デプロイガイド](./lambda-deploy-guide.md) を参照してください。

---

## 全体像

```txt
┌───────────────────────────────────────────────────────────────┐
│                      Cloudflare Workers                       │
│                                                               │
│  torea.app          api.torea.app       │
│  ┌─────────────────┐           ┌───────────────┐              │
│  │   Web (Next.js) │           │ Server (Hono) │              │
│  │   OpenNext      │           │   tsdown      │              │
│  └───────┬─────────┘           └───────┬───────┘              │
│          │                             │                      │
│          ▼                             ▼                      │
│    ┌──────────┐  ┌─────────────┐  ┌────────────────────┐      │
│    │  D1 (DB) │  │ R2 (Storage)│  │ Queue              │      │
│    └──────────┘  └─────────────┘  │  - Video Processing│      │
│                                   │  - Transcription   │      │
│                                   └─────────┬──────────┘      │
│                                             │                 │
└─────────────────────────────────────────────┼─────────────────┘
                                              │ aws4fetch
                                              ▼
                                   ┌────────────────────────┐
                                   │    AWS Lambda          │
                                   │  Video Processor       │
                                   │  - FFmpeg remux        │
                                   │  - Groq transcription  │
                                   └────────────────────────┘
```

デプロイは GitHub Actions が `main` ブランチへの push をトリガーに自動実行します。
内部では Alchemy（TypeScript IaC）が D1・R2・KV・Queue（動画変換 + 文字起こし）・Workers をまとめて管理します。

---

## Step 1: Cloudflare API Token の作成

Alchemy が Cloudflare のリソースを操作するために API Token が必要です。

### 1-1. トークンの作成

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) にログイン
2. 右上のプロフィールアイコン → **My Profile** → 左メニューの **API Tokens**
3. **Create Token** をクリック
4. **Custom token** の「Get started」をクリック
5. 以下の権限を設定:

| リソース | 権限 |
| ---------- | ------ |
| **Account** → Workers Scripts | Edit |
| **Account** → Workers KV Storage | Edit |
| **Account** → D1 | Edit |
| **Account** → R2 | Edit |
| **Account** → Cloudflare Pages | Edit |
| **Account** → Workers Queues | Edit |
| **Zone** → Workers Routes | Edit |
| **Zone** → DNS | Edit |

1. **Account Resources**: 対象アカウントを選択（`All accounts` でも可）
2. **Zone Resources**: `All zones` または `torea.app` のゾーンのみ
3. **Create Token** → 表示されたトークンを**コピーして安全に保存**（二度と表示されません）

### 1-2. Account ID の取得

1. Cloudflare ダッシュボードで任意のドメインを選択
2. 右サイドバーの **API** セクションに **Account ID** が表示されています
3. コピーしておきます

---

## Step 2: 本番用シークレットの生成

以下の 4 つのシークレットを生成します。それぞれ別の値にしてください:

```bash
# 1. BETTER_AUTH_SECRET（認証セッション暗号化）
openssl rand -base64 32

# 2. ALCHEMY_PASSWORD（state ファイルの暗号化）
openssl rand -base64 32

# 3. ALCHEMY_STATE_TOKEN（リモート state ストアの認証トークン）
openssl rand -base64 32
```

> **重要**:
>
> - `ALCHEMY_PASSWORD` は一度設定したら変更しないでください。変更すると既存の state が復号できなくなり、リソースの再作成が必要になります。
> - `ALCHEMY_STATE_TOKEN` も一度設定したら変更しないでください。変更すると state ストアへの認証が失敗します（変更が必要な場合は `CloudflareStateStore` の `forceUpdate: true` オプションが必要です）。

---

## Step 3: GitHub リポジトリに Secrets / Variables を設定

GitHub CLI (`gh`) を使って設定します。

> **前提**: `gh auth login` 済みであること。未ログインの場合は先に実行してください。

### 3-1. Secrets（機密情報）

各コマンドを実行すると、対話的に値の入力を求められます（シェル履歴に残りません）。

```bash
# Cloudflare 認証
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID

# Alchemy
gh secret set ALCHEMY_PASSWORD
gh secret set ALCHEMY_STATE_TOKEN

# アプリケーション シークレット
gh secret set BETTER_AUTH_SECRET
gh secret set RESEND_API_KEY

# AWS Lambda（動画変換 + 文字起こし）
gh secret set AWS_ACCESS_KEY_ID
gh secret set AWS_SECRET_ACCESS_KEY
```

| Secret 名 | 値 | 説明 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Step 1 で作成したトークン | Cloudflare リソース操作用 |
| `CLOUDFLARE_ACCOUNT_ID` | Step 1 で取得した Account ID | Cloudflare アカウント識別 |
| `ALCHEMY_PASSWORD` | Step 2 で生成した値 | state 暗号化用 |
| `ALCHEMY_STATE_TOKEN` | Step 2 で生成した値 | リモート state ストア認証用 |
| `BETTER_AUTH_SECRET` | Step 2 で生成した値 | 認証セッション暗号化 |
| `RESEND_API_KEY` | Resend の API キー | メール送信 API キー |
| `AWS_ACCESS_KEY_ID` | IAM ユーザーの Access Key | Lambda 呼び出し認証用 |
| `AWS_SECRET_ACCESS_KEY` | IAM ユーザーの Secret Key | Lambda 呼び出し認証用 |

### 3-2. Variables（非機密の設定値）

```bash
gh variable set CORS_ORIGIN --body "https://torea.app"
gh variable set BETTER_AUTH_URL --body "https://torea.app"
gh variable set NEXT_PUBLIC_SERVER_URL --body "https://api.torea.app"
gh variable set NEXT_PUBLIC_APP_URL --body "https://torea.app"
gh variable set FROM_EMAIL --body "noreply@mail.naokiyazawa.com"
gh variable set COOKIE_DOMAIN --body "torea.app"
gh variable set LAMBDA_FUNCTION_URL --body "https://xxxxx.lambda-url.ap-northeast-1.on.aws/"
gh variable set LAMBDA_REGION --body "ap-northeast-1"
```

| Variable 名 | 値 | 説明 |
| --- | --- | --- |
| `CORS_ORIGIN` | `https://torea.app` | CORS 許可オリジン |
| `BETTER_AUTH_URL` | `https://torea.app` | 認証サーバーの Base URL |
| `NEXT_PUBLIC_SERVER_URL` | `https://api.torea.app` | クライアントからの API 通信先 |
| `NEXT_PUBLIC_APP_URL` | `https://torea.app` | Web アプリの公開 URL |
| `FROM_EMAIL` | `noreply@mail.naokiyazawa.com` | メール送信元アドレス |
| `COOKIE_DOMAIN` | `torea.app` | Cookie のドメイン（サブドメイン共有用） |
| `LAMBDA_FUNCTION_URL` | Lambda Function URL | 動画変換 + 文字起こし Lambda の呼び出し先 |
| `LAMBDA_REGION` | `ap-northeast-1` | Lambda のリージョン（aws4fetch の署名に使用） |

### 3-3. 設定の確認

```bash
gh secret list
gh variable list
```

Secrets は 8 件、Variables は 8 件が表示されれば OK です。

---

## Step 4: DNS レコードの確認

Alchemy の `domains` 設定により、デプロイ時にカスタムドメインが自動的に Workers に紐付けられます。
Cloudflare にドメインが登録済みであれば、**DNS レコードは Alchemy が自動作成**します。

手動設定は不要ですが、デプロイ後に以下のドメインが正しく解決されることを確認してください:

| ドメイン | 用途 |
| ---------- | ------ |
| `torea.app` | Web アプリ（Next.js） |
| `api.torea.app` | API サーバー（Hono） |

---

## Step 5: デプロイの実行

`main` ブランチに push すると GitHub Actions が自動でデプロイします:

```bash
git push origin main
```

デプロイ完了後、以下の URL でアクセスできるようになります:

| URL | 用途 |
| --- | --- |
| `https://torea.app` | Web アプリ |
| `https://api.torea.app` | API サーバー |

---

## Step 6: デプロイ後の確認

### 6-1. 動作確認

1. `https://torea.app` にブラウザでアクセスし、ページが表示されることを確認
2. `https://api.torea.app/health` にアクセスし、`{"status":"ok"}` が返ることを確認
3. サインアップ・メール認証・ログインフローが正常に動作することを確認

### 6-2. 動画変換 + 文字起こしパイプラインの確認

1. Chrome 拡張から録画を開始・完了する
2. Web ダッシュボードで録画のステータスが `最適化中` → `完了` に遷移することを確認
3. 変換後の動画が Fast Start（シーク即時開始）で再生できることを確認
4. 録画詳細ページで「文字起こし中...」→ セグメント一覧表示に遷移することを確認
5. タイムスタンプクリックで動画がシークすることを確認

### 6-3. SSL/TLS の確認

Cloudflare が自動で SSL 証明書を発行します。
初回は反映まで数分かかることがあります。

`https://torea.app` にアクセスして鍵アイコンが表示されれば OK です。

---

## Alchemy が自動処理する内容

`pnpm deploy` の 1 コマンドで以下がすべて自動実行されます:

1. **D1 データベース** — 作成（初回） + マイグレーション適用
2. **R2 バケット** — 作成（初回）
3. **KV Namespace** — 作成（初回）
4. **Queue** — 作成（初回）、動画変換キュー + 文字起こしキュー
5. **Web (Next.js)** — OpenNext でビルド → Workers にデプロイ + `torea.app` に紐付け
6. **Server (Hono)** — tsdown でビルド → Workers にデプロイ + `api.torea.app` に紐付け
7. **DNS レコード** — カスタムドメインの CNAME/A レコードを自動作成
8. **環境変数バインディング** — D1, R2, KV, Queue, シークレット等を各 Worker にバインド

---

## トラブルシューティング

### GitHub Actions のデプロイが失敗する

1. Actions タブでログを確認
2. よくある原因:
   - Secrets/Variables の設定漏れ → Step 3 を再確認
   - Cloudflare API Token の権限不足 → Step 1 を再確認（Workers Queues の Edit 権限を確認）
   - `ALCHEMY_STATE_TOKEN` の期限切れ → 再生成して Secret を更新

### DNS が解決されない

Cloudflare ダッシュボードの DNS 設定で、各サブドメインのレコードが存在し、プロキシ（オレンジ雲）が有効になっていることを確認してください。

### ビルドエラー

GitHub Actions のログで、どのアプリ（web / server）のビルドが失敗しているかを特定し、該当コードを修正して再 push してください。

### Alchemy state の不整合

本番の state はリモート（CloudflareStateStore）に保存されます。
state と実際のリソースが不一致の場合は [Alchemy ドキュメント](https://alchemy.run/) を参照してください。

### 動画変換が動作しない

1. Lambda 関数がデプロイ済みか確認 → [Lambda デプロイガイド](./lambda-deploy-guide.md)
2. `LAMBDA_FUNCTION_URL`（Variable）、`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（Secret）が正しく設定されているか確認
3. Lambda のログを確認: `aws logs tail /aws/lambda/torea-video-processor --follow`

### 文字起こしが動作しない

1. Lambda の環境変数に `GROQ_API_KEY` が設定されているか確認 → [Lambda デプロイガイド](./lambda-deploy-guide.md)
2. `GROQ_API_KEY` は Lambda 側の環境変数であり、GitHub Secrets / Cloudflare Worker には不要
3. Lambda のログで Groq API のエラー（429 Rate Limit, 413 File Too Large 等）を確認
4. Groq の無料プランには 7200 audio sec/hr の制限あり。長時間動画の連続処理で制限に達する場合は Dev プランへのアップグレードを検討

---

## チェックリスト

デプロイ前に確認:

- [ ] Cloudflare API Token を作成し、必要な権限を付与した（Step 1）
- [ ] Cloudflare Account ID を取得した（Step 1）
- [ ] 本番用シークレット 3 つを生成した（Step 2）
- [ ] GitHub Secrets に 8 つの値をすべて登録した（Step 3）
- [ ] GitHub Variables に 8 つの値をすべて登録した（Step 3）
- [ ] Lambda 関数をデプロイ済み（[Lambda デプロイガイド](./lambda-deploy-guide.md)）
- [ ] `main` ブランチに push して GitHub Actions でデプロイを実行した（Step 5）

デプロイ後に確認:

- [ ] `https://torea.app` にアクセスできる
- [ ] `https://api.torea.app/health` が `{"status":"ok"}` を返す
- [ ] SSL 証明書が有効（鍵アイコン表示）
- [ ] サインアップ・メール認証・ログインフローが正常に動作する
- [ ] 動画録画 → アップロード → 変換 → 再生が正常に動作する
- [ ] 文字起こしがセグメント付きで表示される

---

## 参考リンク

- [Alchemy ドキュメント](https://alchemy.run/)
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 ドキュメント](https://developers.cloudflare.com/r2/)
- [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Resend ドキュメント](https://resend.com/docs)
- [Lambda デプロイガイド](./lambda-deploy-guide.md)
