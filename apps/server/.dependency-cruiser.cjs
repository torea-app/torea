/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  extends: "dependency-cruiser/configs/recommended-strict",

  forbidden: [
    // =========================================================================
    // Clean Architecture Layer Rules
    // =========================================================================

    // Domain は最も内側のレイヤー。外部レイヤーへの依存を一切禁止。
    {
      name: "domain-no-outer-layer",
      comment:
        "domain/ は純粋な型定義・エラー定義のみ。routes/middleware/use-cases/infrastructure/cron への依存禁止。",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        path: "^src/(routes|middleware|use-cases|infrastructure|cron)/",
      },
    },

    // Infrastructure は domain のみに依存可能。上位レイヤーへの逆依存を禁止。
    {
      name: "infrastructure-no-upper-layer",
      comment:
        "infrastructure/ は routes/middleware/use-cases/cron に依存してはならない。",
      severity: "error",
      from: { path: "^src/infrastructure/" },
      to: {
        path: "^src/(routes|middleware|use-cases|cron)/",
      },
    },

    // Use-cases は domain と infrastructure に依存可能。routes/middleware/cron への依存を禁止。
    {
      name: "use-cases-no-presentation-layer",
      comment:
        "use-cases/ は routes/middleware/cron に依存してはならない（DI で infrastructure を受け取る）。",
      severity: "error",
      from: { path: "^src/use-cases/" },
      to: {
        path: "^src/(routes|middleware|cron)/",
      },
    },

    // Middleware は横断的関心事（認証・認可・検証等）に限定する。
    // routes/cron/use-cases への依存を禁止し、ビジネスロジックの混入を防ぐ。
    {
      name: "middleware-no-routes-cron-or-use-cases",
      comment: "middleware/ は routes/cron/use-cases に依存してはならない。",
      severity: "error",
      from: { path: "^src/middleware/" },
      to: {
        path: "^src/(routes|cron|use-cases)/",
      },
    },

    // Cron は routes/middleware に依存してはならない（独立したエントリポイント）。
    // Cron は Composition Root と同様に infrastructure の具象実装を直接インスタンス化する。
    // （LineClient 等を DI ではなく直接生成するのは、cron がエントリポイントであるため意図的）
    {
      name: "cron-no-routes-or-middleware",
      comment:
        "cron/ は routes/middleware に依存してはならない。use-cases/infrastructure/domain のみ使用可能。",
      severity: "error",
      from: { path: "^src/cron/" },
      to: {
        path: "^src/(routes|middleware)/",
      },
    },

    // Routes は cron に依存してはならない（独立したエントリポイント同士の依存を防止）。
    {
      name: "routes-no-cron",
      comment:
        "routes/ は cron/ に依存してはならない。両者は独立したエントリポイント。",
      severity: "error",
      from: { path: "^src/routes/" },
      to: {
        path: "^src/cron/",
      },
    },

    // Use-cases は infrastructure の具象実装（LINE クライアント・Google・暗号化等）を value import してはならない。DI で受け取るために type import は許容する。
    // メッセージビルダー等のユーティリティ関数も DI 経由で渡すか、domain/services に純粋関数として移動すること。
    // pathNot で repositories/ をホワイトリストにすることで、新しい infrastructure サブディレクトリ追加時にも自動的に保護される。
    {
      name: "use-cases-no-infrastructure-impl",
      comment:
        "use-cases/ は infrastructure/repositories/ 以外の infrastructure を value import してはならない。" +
        "LineClient/GoogleCalendarClient 等は type import + DI で受け取ること。",
      severity: "error",
      from: { path: "^src/use-cases/" },
      to: {
        path: "^src/infrastructure/",
        pathNot: "^src/infrastructure/repositories/",
        dependencyTypesNot: ["type-only"],
      },
    },

    // =========================================================================
    // Feature Isolation (use-cases 内のサブディレクトリ間の横断禁止)
    // =========================================================================
    {
      name: "no-cross-feature-in-use-cases",
      comment:
        "use-cases/ 内の各機能ディレクトリは、他の機能ディレクトリに依存してはならない。共通ロジックは domain/ または infrastructure/ に置く。",
      severity: "error",
      from: { path: "^src/use-cases/([^/]+)/" },
      to: {
        path: "^src/use-cases/([^/]+)/",
        pathNot: "^src/use-cases/$1/",
      },
    },

    // =========================================================================
    // 外部パッケージ制限（レイヤーごとに使用可能なパッケージを制限）
    // =========================================================================

    // Use-cases は DB パッケージを直接使用してはならない。
    // DB 操作は必ず infrastructure/repositories を経由する。
    {
      name: "use-cases-no-direct-db",
      comment:
        "use-cases/ は drizzle-orm / @screenbase/db を直接 import してはならない。DB 操作は repository 経由で行う。",
      severity: "error",
      from: { path: "^src/use-cases/" },
      to: {
        path: ["drizzle-orm", "@screenbase/db"],
      },
    },

    // Domain は外部パッケージに依存してはならない（純粋な型・エラー定義のみ）。
    {
      name: "domain-no-external-packages",
      comment: "domain/ は外部パッケージに依存してはならない。",
      severity: "error",
      from: { path: "^src/domain/" },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-optional",
          "npm-peer",
          "npm-bundled",
          "npm-no-pkg",
        ],
      },
    },

    // @screenbase/shared/schemas（Zod バリデーションスキーマ）は routes/ でのみ使用可能。
    // use-cases/infrastructure/domain/cron にバリデーションロジックが漏洩するのを防ぐ。
    // 日付ユーティリティ（@screenbase/shared/date 等）は各レイヤーで使用可能。
    {
      name: "shared-schemas-only-in-routes",
      comment:
        "@screenbase/shared/schemas は routes/ でのみ使用可能。" +
        "バリデーションスキーマを presentation 層に閉じ込める。",
      severity: "error",
      from: {
        path: "^src/(domain|infrastructure|use-cases|middleware|cron)/",
      },
      to: { path: "@screenbase/shared/schemas" },
    },

    // hono / @hono/* は presentation 層（routes/middleware）と Composition Root（src/ 直下）でのみ使用可能。
    // use-cases/infrastructure/domain/cron に Web フレームワーク依存が混入すると、テスタビリティとポータビリティが損なわれる。
    {
      name: "hono-only-in-presentation",
      comment:
        "hono / @hono/* は routes/middleware/src直下でのみ使用可能。" +
        "use-cases/infrastructure/domain/cron からの import を禁止。",
      severity: "error",
      from: { path: "^src/(domain|infrastructure|use-cases|cron)/" },
      to: { path: ["^hono", "^@hono/"] },
    },

    // @screenbase/auth は middleware/（認証・RBAC）と routes/auth.route.ts でのみ使用可能。
    // use-cases/infrastructure/domain/cron から直接 import すると認証ロジックが散在する。
    // ルールを2つに分割:
    //   1. use-cases/infrastructure/domain/cron からの import を全面禁止
    //   2. routes/ 内では auth.route.ts のみ許可（他の route ファイルからの import を禁止）
    {
      name: "auth-not-from-inner-layers",
      comment:
        "@screenbase/auth は use-cases/infrastructure/domain/cron から import してはならない。",
      severity: "error",
      from: { path: "^src/(use-cases|infrastructure|domain|cron)/" },
      to: { path: "@screenbase/auth" },
    },
    {
      name: "auth-not-from-routes-except-auth-route",
      comment:
        "@screenbase/auth は routes/ 内では auth.route.ts のみ使用可能。" +
        "他の route ファイルからの直接 import を禁止。",
      severity: "error",
      from: {
        path: "^src/routes/",
        pathNot: "^src/routes/auth\\.route\\.ts$",
      },
      to: { path: "@screenbase/auth" },
    },

    // @screenbase/env は src/ 直下（Composition Root: app.ts）でのみ使用可能。
    // 各レイヤーで env を直接読むと設定の管理が散在する。
    // 環境変数は Hono の c.env（Bindings）経由で DI する設計。
    {
      name: "env-only-in-composition-root",
      comment:
        "@screenbase/env は src/ 直下（Composition Root）でのみ使用可能。" +
        "各レイヤーは c.env（Bindings）経由で環境変数を受け取ること。",
      severity: "error",
      from: {
        path: "^src/(domain|infrastructure|use-cases|middleware|routes|cron)/",
      },
      to: { path: "@screenbase/env" },
    },

    // Routes / Middleware / Cron は drizzle(c.env.DB) でリポジトリを生成するため drizzle-orm/d1 を使用する。これは DI パターンの一部であり許容する。
    // ただし @screenbase/db/schema の直接使用（= クエリの直書き）は禁止。
    // DB クエリは必ず repository 経由で行う。
    {
      name: "presentation-and-cron-no-direct-db",
      comment:
        "routes/middleware/cron は @screenbase/db を直接 import してはならない。DB クエリは repository 経由で行う。",
      severity: "error",
      from: { path: "^src/(routes|middleware|cron)/" },
      to: {
        path: "@screenbase/db",
      },
    },

    // =========================================================================
    // Composition Root（src/ 直下のファイル: index.ts, app.ts, types.ts, hc.ts）
    // =========================================================================
    // src/ 直下はアプリケーションのエントリポイント（Composition Root）であり、全レイヤーへの依存を意図的に許可している。
    // 新規ファイルを src/ 直下に追加する場合はエントリポイントに限定すること。
    // types.ts は型定義のみのため、routes/middleware/cron からの参照を許容する。
    {
      name: "no-import-entry-points",
      comment:
        "各レイヤーから app.ts / index.ts / hc.ts を import してはならない（Composition Root の逆依存防止）。",
      severity: "error",
      from: {
        path: "^src/(domain|infrastructure|use-cases|middleware|routes|cron)/",
      },
      to: {
        path: "^src/(app|index|hc)\\.ts$",
      },
    },

    // =========================================================================
    // 循環依存
    // =========================================================================

    // ランタイム循環依存を error として禁止。
    // type-only import はコンパイル時に消えるため、循環経路に type-only が含まれていればランタイムでは循環にならない。viaOnly で type-only を除外する。
    {
      name: "no-circular",
      comment:
        "ランタイム循環依存を禁止（type-only import を経路に含む循環は除外）。",
      severity: "error",
      from: {},
      to: {
        circular: true,
        viaOnly: {
          dependencyTypesNot: ["type-only"],
        },
      },
    },
    // type-only のみで構成される循環は実害がないが、設計の見直しシグナルとして warn。
    {
      name: "no-circular-type-only",
      comment: "type-only のみの循環依存は警告（ランタイムには影響しない）。",
      severity: "warn",
      from: {},
      to: { circular: true },
    },

    // =========================================================================
    // recommended-strict プリセットの無効化（他ツールと責務が重複するため）
    // =========================================================================

    // knip が エントリポイント起点の到達性解析で検出する（より正確）
    { name: "no-orphans", severity: "ignore", from: {}, to: {} },

    // tsc --noEmit が型チェック時に検出する
    { name: "not-to-unresolvable", severity: "ignore", from: {}, to: {} },
  ],

  options: {
    doNotFollow: {
      path: "node_modules",
    },

    // includeOnly は使用しない（外部パッケージへの依存ルールを有効にするため）。
    // doNotFollow: node_modules で深い探索を防止しつつ、エッジは可視化する。

    tsPreCompilationDeps: true,

    tsConfig: {
      fileName: "./tsconfig.json",
    },

    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types"],
    },

    // pnpm のシンボリックリンクを保持
    preserveSymlinks: true,

    cache: {
      strategy: "content",
    },

    progress: { type: "performance-log" },

    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
