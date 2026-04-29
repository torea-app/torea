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
│       torea.app                  api.torea.app                │
│  ┌─────────────────┐           ┌───────────────┐              │
│  │   Web (Next.js) │           │ Server (Hono) │              │
│  │   OpenNext      │           │   tsdown      │              │
│  └───────┬─────────┘           └───────┬───────┘              │
│          │                             │                      │
│          ▼                             ▼                      │
│    ┌──────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│    │  D1 (DB) │  │ R2 (Storage)│  │ Queue               │     │
│    └──────────┘  └─────────────┘  │  - Video Processing │     │
│                                   │  - Transcription    │     │
│                                   │  - Drive Export     │     │
│                                   │  - Webhook Delivery │     │
│                                   └─────────┬───────────┘     │
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
内部では Alchemy（TypeScript IaC）が D1・R2・KV・Queue・Workers をまとめて管理します。

外部サービス（Google Cloud / Stripe）は GitHub Actions の前に Web Console 上で 1 度だけ初期設定が必要です（Step 3 / Step 4）。

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

# 4. INTEGRATION_ENCRYPTION_KEY（外部連携トークンの at-rest 暗号化 / AES-256-GCM）
openssl rand -base64 32
```

> **重要**:
>
> - `ALCHEMY_PASSWORD` は一度設定したら変更しないでください。変更すると既存の state が復号できなくなり、リソースの再作成が必要になります。
> - `ALCHEMY_STATE_TOKEN` も一度設定したら変更しないでください。変更すると state ストアへの認証が失敗します（変更が必要な場合は `CloudflareStateStore` の `forceUpdate: true` オプションが必要です）。
> - `INTEGRATION_ENCRYPTION_KEY` を変更すると、D1 に保存済みの Google Drive アクセストークン / リフレッシュトークンが復号できなくなります。ローテーション時は連携済みユーザー全員に再連携を案内する必要があるため、原則として一度設定したら固定してください。

---

## Step 3: Google Cloud — OAuth Client の作成（Drive 連携）

torea の Google Drive 連携機能（録画を Google Drive に書き出す）には、OAuth 2.0 Client ID が必要です。

### 3-1. プロジェクトと API の有効化

1. [Google Cloud Console](https://console.cloud.google.com/) で torea 用のプロジェクトを作成（既存プロジェクトを利用してもよい）
2. **APIとサービス** → **ライブラリ** → **Google Drive API** を有効化

### 3-2. OAuth 同意画面の構成

1. **APIとサービス** → **OAuth 同意画面**
2. ユーザータイプを選択（社内のみなら Internal、一般公開するなら External）
3. アプリ情報:
   - アプリ名: `Torea`
   - ユーザーサポートメール: 運用窓口のメールアドレス
   - デベロッパー連絡先: 運用窓口のメールアドレス
4. **スコープ** で以下を追加:
   - `https://www.googleapis.com/auth/drive.file`（非機密スコープ。ユーザーが torea 経由で作成・選択したファイルにのみアクセスする）

> torea は `drive.file` のみ要求します。`drive.readonly` 等の機密スコープは使わないため、Google の「センシティブ スコープ アプリ審査」は不要です。

### 3-3. OAuth 2.0 Client ID の作成

1. **APIとサービス** → **認証情報** → **認証情報を作成** → **OAuth クライアント ID**
2. アプリケーションの種類: **ウェブアプリケーション**
3. 名前: `torea-prod`
4. **承認済みのリダイレクト URI** に以下を追加:
   - `https://api.torea.app/api/integrations/google-drive/callback`
5. 作成すると `Client ID` と `Client Secret` が表示されるのでコピーして保存（後で GitHub に登録）

> **ローカル開発用**: 別の Client ID をもう 1 つ作成し、リダイレクト URI に開発環境の URL（例: `http://localhost:3000/api/integrations/google-drive/callback`）を登録してください。

---

## Step 4: Stripe Dashboard の設定（課金）

`@better-auth/stripe` プラグイン経由でユーザー単位の課金（Pro プラン）を行います。

### 4-1. API キーの取得

1. [Stripe Dashboard](https://dashboard.stripe.com/) にログイン
2. テスト期間中はテストモードのキー (`sk_test_...` / `pk_test_...`) で運用し、本番リリース時に Live モードのキーへ切り替えます。
3. **Developers** → **API keys** から取得:
   - **Secret key** (`sk_test_...` または `sk_live_...`)
   - **Publishable key** (`pk_test_...` または `pk_live_...`)

### 4-2. Product / Price の作成

1. **Products** → **Add product** で「Torea Pro」等の Product を作成
2. 月額・年額の Price を 2 つ追加
3. それぞれの Price ID（`price_...`）をコピー

### 4-3. Webhook エンドポイントの作成

1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://api.torea.app/api/auth/stripe/webhook`
   - `@better-auth/stripe` プラグインが Better Auth ハンドラ配下の `/api/auth/stripe/webhook` で受信する設計です。
3. 送信イベントは最低限以下を有効化:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. 作成後の **Signing secret** (`whsec_...`) をコピー

> **テスト → Live への切り替え時**:
>
> - API key と Webhook signing secret を Live モード用に再取得して GitHub Secrets を更新
> - Product/Price は Live モード側で再作成し、新しい Price ID で GitHub Variables を更新
> - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` も `pk_live_...` に差し替え

---

## Step 5: GitHub リポジトリに Secrets / Variables を設定

GitHub CLI (`gh`) を使って設定します。

> **前提**: `gh auth login` 済みであること。未ログインの場合は先に実行してください。

### 5-1. Secrets（機密情報）

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

# Google Drive 連携
gh secret set GOOGLE_OAUTH_CLIENT_SECRET
gh secret set INTEGRATION_ENCRYPTION_KEY

# Stripe
gh secret set STRIPE_SECRET_KEY
gh secret set STRIPE_WEBHOOK_SECRET
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
| `GOOGLE_OAUTH_CLIENT_SECRET` | Step 3-3 で取得した Client Secret | Google Drive OAuth 認可コードフロー |
| `INTEGRATION_ENCRYPTION_KEY` | Step 2 で生成した値 | Drive アクセストークンの at-rest 暗号化 |
| `STRIPE_SECRET_KEY` | `sk_test_...` または `sk_live_...` | Stripe API 呼び出し用 |
| `STRIPE_WEBHOOK_SECRET` | Step 4-3 の Signing secret (`whsec_...`) | Stripe Webhook 署名検証 |

### 5-2. Variables（非機密の設定値）

```bash
# App config
gh variable set CORS_ORIGIN --body "https://torea.app"
# BETTER_AUTH_URL は Better Auth ハンドラ (/api/auth/*) がマウントされている
# Hono server の URL を指定する。Web (Next.js) ではない点に注意。
gh variable set BETTER_AUTH_URL --body "https://api.torea.app"
gh variable set NEXT_PUBLIC_SERVER_URL --body "https://api.torea.app"
gh variable set NEXT_PUBLIC_APP_URL --body "https://torea.app"
gh variable set FROM_EMAIL --body "noreply@mail.naokiyazawa.com"
gh variable set COOKIE_DOMAIN --body "torea.app"
gh variable set LAMBDA_FUNCTION_URL --body "https://xxxxx.lambda-url.ap-northeast-1.on.aws/"
gh variable set LAMBDA_REGION --body "ap-northeast-1"

# Google Drive 連携
gh variable set GOOGLE_OAUTH_CLIENT_ID --body "860826377202-rseq433d68uqhmsmbpnbas0r1th4qdp5.apps.googleusercontent.com"
gh variable set GOOGLE_OAUTH_REDIRECT_URI --body "https://api.torea.app/api/integrations/google-drive/callback"

# Stripe
# Publishable key はクライアントに露出する設計のため Variable で扱う
gh variable set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY --body "pk_test_51TRR2EIzbwP5EdYdua2DmKi3Egi3gQoKJIZsaJQvQaq8hP4PylGg1tMcKSGv5CzLUqAHW4MWTRPdSZzkGelgRoKC0002HVqmTs"
gh variable set STRIPE_PRICE_ID_PRO_MONTH --body "price_1TRTsWIzbwP5EdYdXeagXl4F"
gh variable set STRIPE_PRICE_ID_PRO_YEAR --body "price_1TRTsXIzbwP5EdYd4Kj2mCg4"
gh variable set STRIPE_PORTAL_RETURN_URL --body "https://torea.app/dashboard/settings/billing"
gh variable set STRIPE_CHECKOUT_SUCCESS_URL --body "https://torea.app/dashboard/settings/billing?status=success"
gh variable set STRIPE_CHECKOUT_CANCEL_URL --body "https://torea.app/pricing?status=canceled"
```

| Variable 名 | 値 | 説明 |
| --- | --- | --- |
| `CORS_ORIGIN` | `https://torea.app` | CORS 許可オリジン |
| `BETTER_AUTH_URL` | `https://api.torea.app` | **Hono server の URL**。Better Auth ハンドラのコールバック URL 組み立てに使用 |
| `NEXT_PUBLIC_SERVER_URL` | `https://api.torea.app` | クライアントからの API 通信先 |
| `NEXT_PUBLIC_APP_URL` | `https://torea.app` | Web アプリの公開 URL |
| `FROM_EMAIL` | `noreply@mail.naokiyazawa.com` | メール送信元アドレス |
| `COOKIE_DOMAIN` | `torea.app` | Cookie のドメイン（サブドメイン共有用） |
| `LAMBDA_FUNCTION_URL` | Lambda Function URL | 動画変換 + 文字起こし Lambda の呼び出し先 |
| `LAMBDA_REGION` | `ap-northeast-1` | Lambda のリージョン（aws4fetch の署名に使用） |
| `GOOGLE_OAUTH_CLIENT_ID` | `...apps.googleusercontent.com` | Step 3-3 で取得した Client ID |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://api.torea.app/api/integrations/google-drive/callback` | Google OAuth リダイレクト URI（Step 3-3 で登録した値と一致させる） |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` / `pk_live_...` | クライアント側 Stripe.js 用 publishable key |
| `STRIPE_PRICE_ID_PRO_MONTH` | `price_...` | Pro プラン月額 Price ID |
| `STRIPE_PRICE_ID_PRO_YEAR` | `price_...` | Pro プラン年額 Price ID |
| `STRIPE_PORTAL_RETURN_URL` | `https://torea.app/dashboard/settings/billing` | Customer Portal からの戻り先（同一オリジン必須） |
| `STRIPE_CHECKOUT_SUCCESS_URL` | `https://torea.app/dashboard/settings/billing?status=success` | Checkout 完了後のリダイレクト先 |
| `STRIPE_CHECKOUT_CANCEL_URL` | `https://torea.app/pricing?status=canceled` | Checkout キャンセル時のリダイレクト先 |

### 5-3. 設定の確認

```bash
gh secret list
gh variable list
```

Secrets は 12 件、Variables は 16 件が表示されれば OK です。

---

## Step 6: DNS レコードの確認

Alchemy の `domains` 設定により、デプロイ時にカスタムドメインが自動的に Workers に紐付けられます。
Cloudflare にドメインが登録済みであれば、**DNS レコードは Alchemy が自動作成**します。

手動設定は不要ですが、デプロイ後に以下のドメインが正しく解決されることを確認してください:

| ドメイン | 用途 |
| ---------- | ------ |
| `torea.app` | Web アプリ（Next.js） |
| `api.torea.app` | API サーバー（Hono） |

---

## Step 7: デプロイの実行

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

## Step 8: デプロイ後の確認

### 8-1. 動作確認

1. `https://torea.app` にブラウザでアクセスし、ページが表示されることを確認
2. `https://api.torea.app/health` にアクセスし、`{"status":"ok"}` が返ることを確認
3. サインアップ・メール認証・ログインフローが正常に動作することを確認

### 8-2. 動画変換 + 文字起こしパイプラインの確認

1. Chrome 拡張から録画を開始・完了する
2. Web ダッシュボードで録画のステータスが `最適化中` → `完了` に遷移することを確認
3. 変換後の動画が Fast Start（シーク即時開始）で再生できることを確認
4. 録画詳細ページで「文字起こし中...」→ セグメント一覧表示に遷移することを確認
5. タイムスタンプクリックで動画がシークすることを確認

### 8-3. Google Drive 連携の確認

1. ダッシュボード → 設定 → 連携 から Google Drive を連携する
2. Google の認可画面で `drive.file` スコープが要求されることを確認
3. 録画詳細から Google Drive へエクスポートし、Drive 上にファイルが保存されることを確認

### 8-4. Stripe 課金フローの確認

1. ダッシュボード → 設定 → 課金 から Pro プランの Checkout に進む
2. Stripe テストカード（`4242 4242 4242 4242`）で Checkout を完了
3. `STRIPE_CHECKOUT_SUCCESS_URL` にリダイレクトされ、プランが `Pro` に切り替わることを確認
4. Stripe Dashboard → Webhooks のログで該当イベントが `200` で受信されていることを確認
5. Customer Portal からのプラン解約 / 再開 / 返金が正常に反映されることを確認

### 8-5. SSL/TLS の確認

Cloudflare が自動で SSL 証明書を発行します。
初回は反映まで数分かかることがあります。

`https://torea.app` にアクセスして鍵アイコンが表示されれば OK です。

---

## Alchemy が自動処理する内容

`pnpm deploy` の 1 コマンドで以下がすべて自動実行されます:

1. **D1 データベース** — 作成（初回） + マイグレーション適用
2. **R2 バケット** — 作成（初回）
3. **KV Namespace** — 作成（初回、`torea-kv` と `torea-webhook-secrets`）
4. **Queue** — 作成（初回、動画変換 / 文字起こし / Webhook 配信 / Drive エクスポート）
5. **Web (Next.js)** — OpenNext でビルド → Workers にデプロイ + `torea.app` に紐付け
6. **Server (Hono)** — tsdown でビルド → Workers にデプロイ + `api.torea.app` に紐付け
7. **DNS レコード** — カスタムドメインの CNAME/A レコードを自動作成
8. **環境変数バインディング** — D1, R2, KV, Queue, シークレット等を各 Worker にバインド

---

## トラブルシューティング

### GitHub Actions のデプロイが失敗する

1. Actions タブでログを確認
2. よくある原因:
   - Secrets/Variables の設定漏れ → Step 5 を再確認（Secrets 12 件 / Variables 16 件）
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

### Google Drive 連携で `redirect_uri_mismatch` が出る

`GOOGLE_OAUTH_REDIRECT_URI`（GitHub Variable）の値と、Google Cloud Console の OAuth Client に登録した「承認済みのリダイレクト URI」が完全一致しているか確認してください（末尾スラッシュやスキームの差異も不可）。

### Stripe Webhook が `400` / `signature verification failed` で失敗する

1. Stripe Dashboard → Webhooks のエンドポイント URL が `https://api.torea.app/api/auth/stripe/webhook` になっているか確認
2. `STRIPE_WEBHOOK_SECRET` がそのエンドポイントの **Signing secret** と一致しているか確認（Test/Live モードで別の secret になる点に注意）
3. テスト → Live 切替時には Live モード側で Webhook を再作成し、新しい `whsec_...` を Secrets に再登録

### Stripe Checkout / Portal の `Invalid return_url`

Stripe は Checkout / Portal の `return_url` / `success_url` / `cancel_url` を Dashboard 側で許可されたドメインに制限します。
`STRIPE_PORTAL_RETURN_URL` 等の Variable が `https://torea.app/...`（= 同一オリジン）になっていることを確認してください。

---

## 環境変数の運用ルール

### `SKIP_*` 系フラグ

ローカル開発では `alchemy.run.ts` が以下を自動で `"true"` に固定します（外部サービスを呼ばない）:

- `SKIP_VIDEO_PROCESSING`
- `SKIP_TRANSCRIPTION`
- `SKIP_DRIVE_EXPORT`

本番デプロイ時は `process.env.<NAME> ?? ""`（= 実行する）を読みます。一時的に本番側で外部呼び出しを止めたい場合は GitHub Actions の env や Variables で `"true"` を明示してください。

### `BETTER_AUTH_URL` の指定先

Better Auth ハンドラ (`/api/auth/*`) は **Hono server (`api.torea.app`)** にマウントされています。`BETTER_AUTH_URL` には必ず Hono server の URL を指定してください（Web (Next.js) 側ではありません）。Stripe Checkout の `success_url` 等のコールバック URL も内部的にこの値を基点に組み立てられるため、誤った値を入れると Better Auth 起因の認可フローが全滅します。

---

## チェックリスト

デプロイ前に確認:

- [ ] Cloudflare API Token を作成し、必要な権限を付与した（Step 1）
- [ ] Cloudflare Account ID を取得した（Step 1）
- [ ] 本番用シークレット 4 つを生成した（Step 2）
- [ ] Google Cloud で OAuth 2.0 Client ID を作成した（Step 3）
- [ ] Stripe Dashboard で API key / Product/Price / Webhook を作成した（Step 4）
- [ ] GitHub Secrets に 12 個の値をすべて登録した（Step 5）
- [ ] GitHub Variables に 16 個の値をすべて登録した（Step 5）
- [ ] Lambda 関数をデプロイ済み（[Lambda デプロイガイド](./lambda-deploy-guide.md)）
- [ ] `main` ブランチに push して GitHub Actions でデプロイを実行した（Step 7）

デプロイ後に確認:

- [ ] `https://torea.app` にアクセスできる
- [ ] `https://api.torea.app/health` が `{"status":"ok"}` を返す
- [ ] SSL 証明書が有効（鍵アイコン表示）
- [ ] サインアップ・メール認証・ログインフローが正常に動作する
- [ ] 動画録画 → アップロード → 変換 → 再生が正常に動作する
- [ ] 文字起こしがセグメント付きで表示される
- [ ] Google Drive 連携と Drive 書き出しが成功する
- [ ] Stripe Checkout → サブスク反映 → Customer Portal の操作が正常に動作する

---

## 参考リンク

- [Alchemy ドキュメント](https://alchemy.run/)
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 ドキュメント](https://developers.cloudflare.com/r2/)
- [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Resend ドキュメント](https://resend.com/docs)
- [Better Auth — Stripe plugin](https://better-auth.com/docs/plugins/stripe)
- [Google Identity — OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Stripe — Webhooks](https://docs.stripe.com/webhooks)
- [Lambda デプロイガイド](./lambda-deploy-guide.md)
