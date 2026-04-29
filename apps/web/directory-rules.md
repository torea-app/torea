# Frontend Directory Rules（早見表）

`apps/web` 配下を実装する際に **必ず** 守るルールのみを並べた早見表。

---

## 1. ディレクトリ命名・配置

### 1.1 4 種類の private folder

App Router 配下では **アンダースコア prefix の private folder** だけを使い、目的ごとに役割を厳格に分ける。

| フォルダ | 役割 | 中身の例 |
| ----------------- | ------------------------------------------------ | -------------------------------------------- |
| `_containers/` | Server Component。データ取得と Presentational への受け渡し | `recordings-container.tsx` |
| `_features/` | UI の塊（feature）。`<feature-name>/index.tsx` をエントリにする | `recordings-view/index.tsx` |
| `_components/` | feature 内・スコープ内で再利用する Presentational 部品 | `recording-row.tsx`, `member-card.tsx` |
| `_lib/` | 型・クエリ・Server Actions・URL state など非 UI ロジック | `types.ts`, `queries.ts`, `actions.ts`, `search-params.ts` |

- private folder は **そのスコープ専用**。同階層・子階層からのみ参照される前提で配置する。
- これら 4 つ以外の private folder（`_utils/`, `_hooks/` など）は作らない。共通化したい場合は `src/lib/` か `_lib/` に集約。

### 1.2 Route Group

- 認証要否で分ける：`(auth)` は未ログイン、`(protected)` はログイン必須。
- Route Group 直下に共通 UI（layout, sidebar など）を置き、配下のページは `_features` 等を持てる。

### 1.3 配置先の判断基準

| 置きたいもの | 置く場所 |
| --- | --- |
| あるページ専用の UI | そのページ配下の `_features/<view-name>/` |
| ある feature 専用の小さい部品 | その feature 配下の `_components/` |
| 同じ Route Group 全体で使う UI | Route Group 直下の `_features/` か `_components/` |
| アプリ全体で使う UI | `src/components/` |
| アプリ全体で使う関数（フォーマッタ等） | `src/lib/format.ts` など `src/lib/` 配下 |
| デザインシステム共通プリミティブ | `@torea/ui`（パッケージ） |

> 共通化は **本当に複数箇所で使うようになってから** 上の階層へ昇格させる。先回りで `src/components/` に置かない（コロケーション優先）。

---

## 2. `page.tsx → container → view` ルール（例外なし）

すべてのページは以下 3 層で構成する。**たとえ container がデータ取得を持たない（empty container）場合でも省略しない**。

```txt
page.tsx                              ← 薄いシェル。<Suspense> と PageHeader だけ
└─ _containers/<name>-container.tsx   ← Server Component。fetch + 失敗ハンドリング
   └─ _features/<name>-view/index.tsx ← View（Presentational のエントリ）
      └─ _components/...              ← 部品（必要に応じて）
```

### 2.1 `page.tsx`

- Server Component（`"use client"` 禁止）。
- 役割は **searchParams のパース、`<Suspense>` の境界、Container の呼び出し** のみ。
- ビジネスロジック・fetch・条件分岐 UI は書かない。

### 2.2 `_containers/<name>-container.tsx`

- Server Component。
- `_lib/queries.ts` から **`ApiResult<T>` を返す関数だけを呼ぶ**。
- `result.success === false` のときは `<EmptyState />` などで握り潰すか、`notFound()` を呼ぶ。
- 取得した data を View に props で渡す。**View で再 fetch しない**。

### 2.3 `_features/<name>-view/index.tsx`

- View のエントリ。Presentational 中心。
- 状態を持つなら `"use client"` を付ける。Server Component のままで済むなら付けない。
- 子 feature・`_components/`・hooks を組み立てる。

---

## 3. Recursive Features（再帰的 features）

### 3.1 子 `_features/` を作る条件

view の中で UI の塊を分けたいとき、以下のどれかを満たすなら **子 `_features/`**、満たさないなら **`_components/`**。

| `_features/<child>/` にする                                   | `_components/<child>.tsx` にする            |
| ------------------------------------------------------------- | ------------------------------------------- |
| 子が独自の `_lib/`（queries / actions / types）を持つ         | データを props で受け取るだけ               |
| 子の中でさらに `_features/` や `_components/` に分割する規模  | 1 ファイルで完結する小さな部品              |
| 子がそのスコープで「ひとつの機能」と呼べる粒度                | レイアウト・表示の都合で分けた部品          |

例：`members-view/_features/members-list/`, `members-view/_features/invite-member-dialog/` は独立した責務なので feature。`recordings-view/_components/recording-row.tsx` は表示部品なので component。

### 3.2 子 feature の構造

子 feature も `_features/<name>/index.tsx` をエントリにし、必要なら `_components/`, `_lib/` を **その feature 配下に** 持つ。**親の `_lib/` に子のロジックを置かない**。

---

## 4. Import 方向ルール

依存は常に **上から下・浅い側から深い側へ一方向**。逆向き・斜め依存は禁止。

### 4.1 禁止する import

| 違反例 | 理由 |
| --- | --- |
| `_lib/queries.ts` が `_features/...` を import | レイヤ逆転。型は `_lib/types.ts` に置き直す |
| `_components/foo.tsx` が `_features/<sibling>/...` を import | 兄弟 feature を直接参照しない。共通化するなら一段上に持ち上げる |
| `app/share/...` が `app/dashboard/(protected)/...` を import | Route Group をまたぐ依存禁止。共通ロジックは `src/lib/` へ |
| 子 feature が親 feature を import | 親 → 子の一方向。子が必要とする props は親から渡す |

### 4.2 推奨する import

- `_containers/` から `_lib/` と `_features/<view>/index.tsx` を import。
- `_features/<view>/index.tsx` から `_components/`、子 `_features/`、`_lib/types.ts` を import。
- どこからでも `src/lib/`、`src/components/`、`@torea/ui`、`@torea/server/hc` は import 可。

### 4.3 path alias

- `@/` は `src/` を指す。Route 間の参照は **基本的に行わない** が、`src/lib/`・`src/components/` への参照は `@/lib/...`・`@/components/...` で書く。
- `@/app/...` を別 Route から import するのは Route Group 越え依存になりうるので避ける。

---

## 5. 型定義ルール

### 5.1 手動 type 定義は禁止

API レスポンス・リクエスト型は **Hono RPC の `InferResponseType` から導出する**。`type Foo = { ... }` の手書きは行わない。

```ts
// _lib/types.ts
import type { Client, InferResponseType } from "@torea/server/hc";

type RecordingsApi = Client["api"]["recordings"];

export type Recording = InferResponseType<RecordingsApi["$get"], 200>["recordings"][number];
export type TranscriptionData = InferResponseType<
  RecordingsApi[":id"]["transcription"]["$get"],
  200
>;
```

### 5.2 型は `_lib/types.ts` に集約

- View や Component ファイルの中で `type Foo = ...` を再定義しない。必ず `_lib/types.ts` から import する。
- 子要素型は `Type[number]`, `NonNullable<Type["field"]>[number]` のように **既存型から派生** させる。
- `as` キャスト・`as any`・`as unknown as Foo` は原則禁止。型が合わないなら **サーバー route 側の型注釈で正す**（例：`JSON.parse` の戻り値に明示型を付ける）。

### 5.3 ApiResult を返す関数の型

`_lib/queries.ts` の関数は **戻り値を必ず `Promise<ApiResult<T>>`** にする。例外を投げず、`handleApiResponse` を通す。

---

## 6. データ取得・更新ルール

### 6.1 Server-side fetch（推奨）

- `_lib/queries.ts` で `createServerApi()`（`@/lib/api.server`）を使い Cookie 転送付きで fetch。
- レスポンスは **必ず `handleApiResponse<T>(res)` で `ApiResult<T>` に揃える**。

```ts
import { createServerApi } from "@/lib/api.server";
import { handleApiResponse } from "@/lib/handle-api-response";
import type { ApiResult } from "@/lib/handle-api-response";
import type { Recording } from "./types";

export async function getRecording(id: string): Promise<ApiResult<Recording>> {
  const api = await createServerApi();
  const res = await api.api.recordings[":id"].$get({ param: { id } });
  return handleApiResponse<Recording>(res);
}
```

### 6.2 Public 経路（token-based）

`share/[token]`, `embed/[token]` のような公開ページは Cookie 認証を使わないので `createServerApi()` を **使わない**。素の `fetch(NEXT_PUBLIC_SERVER_URL + "/api/share/...")` を `handleApiResponse` で包む。

### 6.3 Server Actions

- `_lib/actions.ts` に `"use server"` で配置。
- ミューテーション後は **`revalidatePath()` でキャッシュを invalidate** する。
- フォームには `@tanstack/react-form` + `zod` を使う。

### 6.4 Client-side mutation

- 楽観更新（optimistic update）を行うときは **失敗時のロールバック** を必ず実装する。
- `useSession` ではなく `useAuth()`（`@/components/auth-provider`）を使う。

---

## 7. URL State

- Query string の状態管理には `nuqs` を使う。
- パーサは `_lib/search-params.ts` に `loadXxxSearchParams` として定義し、`page.tsx` で展開して Container に props で渡す。
- View 側で URL を直接読まない（テスタビリティのため）。

---

## 8. 命名規則

| 対象 | 命名 |
| --- | --- |
| Container ファイル | `<name>-container.tsx`（kebab-case） |
| View ファイル | `_features/<name>-view/index.tsx` |
| 子 feature | `_features/<name>/index.tsx`（kebab-case） |
| Component ファイル | `_components/<name>.tsx`（kebab-case） |
| `_lib/` 内の標準ファイル | `types.ts`, `queries.ts`, `actions.ts`, `search-params.ts` |
| Hooks | `use-xxx.ts` |
| エクスポート関数・コンポーネント | `PascalCase`（コンポーネント）/ `camelCase`（関数） |

---

## 9. その他の必須ルール

- **`"use client"` は最小限**。Server で済むなら付けない。Container には絶対に付けない。
- **shadcn/ui プリミティブは `@torea/ui/components/ui/...` から import**。アプリ側で同等のものを再実装しない。
- **アイコンは `lucide-react`** に統一。
- **フォーマッタ等の汎用関数は `src/lib/format.ts`** に置き、feature 配下に同名関数を作らない（`formatDuration`, `formatFileSize`, `formatRelativeTime` など）。
- **環境変数は `@torea/env/web`** から読む。`process.env` を直接参照しない。
- **`page.tsx` の `<Suspense>` には `<LoadingSkeleton />`** など共通の fallback を渡す。

---

## 10. チェックリスト（実装前/PR 前に確認）

- [ ] `page.tsx` は薄いシェルか（fetch・条件分岐 UI を持っていない）
- [ ] `_containers/` で fetch し、`_features/<view>/index.tsx` には props で渡しているか
- [ ] `_lib/queries.ts` は `Promise<ApiResult<T>>` を返しているか
- [ ] 型を手書きしていないか（`InferResponseType` から導出しているか）
- [ ] `_lib → _features` の逆方向 import が無いか
- [ ] Route Group をまたぐ import が無いか
- [ ] 子 feature が独自 `_lib/` を持つ規模か。そうでなければ `_components/` に格下げしているか
- [ ] `as any` / `as unknown as Foo` を入れていないか
- [ ] Mutation 後に `revalidatePath()` を呼んでいるか
- [ ] フォーマッタを feature 配下に再定義していないか（`src/lib/format.ts` を import）
