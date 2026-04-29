"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@torea/ui/components/ui/accordion";
import { buttonVariants } from "@torea/ui/components/ui/button";
import {
  ArrowRightIcon,
  CodeIcon,
  FileTextIcon,
  HardDriveIcon,
  MessageSquareTextIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#features", label: "機能" },
  { href: "#use-cases", label: "使い道" },
  { href: "#faq", label: "FAQ" },
] as const;

const FEATURES = [
  {
    icon: ZapIcon,
    title: "録画中も、ブラウザは軽いまま。",
    body: "録ると同時にチャンク単位でリアルタイム配信。CPU もメモリも食わずに、3 時間の長尺でも最後まで安定して撮りきれます。",
    surface: "group-hover:bg-surface-peach",
    iconHover: "group-hover:bg-card",
  },
  {
    icon: FileTextIcon,
    title: "文字起こしが、ぜんぶ無料。",
    body: "Whisper Large v3 Turbo による多言語の自動文字起こしを、無料プランから開放。議事録もチュートリアルも、撮るだけで完成します。",
    surface: "group-hover:bg-surface-sage",
    iconHover: "group-hover:bg-card",
  },
  {
    icon: MessageSquareTextIcon,
    title: "動画の「この瞬間」に、書く。",
    body: "再生時間に紐づくタイムスタンプコメントで、レビューの行き来を非同期で終わらせる。スレッドでそのまま議論できます。",
    surface: "group-hover:bg-surface-lavender",
    iconHover: "group-hover:bg-card",
  },
  {
    icon: ShieldCheckIcon,
    title: "組織内だけ。または、パスワード付き。",
    body: "組織のメンバーに限定した共有から、外部向けのパスワード保護まで。リンクごとに公開範囲を切り替えられます。",
    surface: "group-hover:bg-surface-mist",
    iconHover: "group-hover:bg-card",
  },
  {
    icon: CodeIcon,
    title: "Notion に、そのまま埋め込める。",
    body: "Notion の埋め込みブロックに共有 URL を貼れば、再生プレーヤーがそのまま展開されます。oEmbed プロバイダとしても動作し、対応サービスを順次広げていきます。",
    surface: "group-hover:bg-surface-peach",
    iconHover: "group-hover:bg-card",
  },
  {
    icon: HardDriveIcon,
    title: "Google Drive に、そのまま保存。",
    body: "撮った動画と文字起こしを、自分の Google Drive に自動保存。組織のストレージポリシーや永続バックアップにも馴染みます。",
    surface: "group-hover:bg-surface-sage",
    iconHover: "group-hover:bg-card",
  },
] as const;

const USE_CASES = [
  {
    label: "バグ報告",
    title: "「再現手順、撮って送りますね。」",
    body: "文章で書くより速く、画面の動きごと渡す。タイムスタンプコメントで、再現箇所もピンポイントに指せます。",
  },
  {
    label: "コードレビュー",
    title: "「3 分の動画で、意図ごと伝える。」",
    body: "長文の PR コメントが要らなくなる。声と画面で背景を渡せば、相手は自分のペースで観返せます。",
  },
  {
    label: "議事録 / 共有",
    title: "「録画と文字起こし、1 セットで。」",
    body: "会議をそのまま録画。文字起こしと一緒に共有して、後から検索もダウンロードもできます。",
  },
] as const;

const FAQ = [
  {
    q: "利用は無料ですか？",
    a: "無料プランで、録画・組織共有・タイムスタンプコメント・自動文字起こし・ダウンロードまでひと通り使えます。長時間録画や 4K、無期限保存などは有料プランで提供予定です。",
  },
  {
    q: "長時間の録画でも、ブラウザは大丈夫ですか？",
    a: "torea は録画と同時に Cloudflare R2 へマルチパートでリアルタイムアップロードするため、ブラウザ側にメモリを溜め込みません。会議や講義など 1〜3 時間の長尺でも、安定して撮影できます。",
  },
  {
    q: "録画したデータはどこに保存されますか？",
    a: "Cloudflare R2 (オブジェクトストレージ) に保存されます。共有はリンクごとに「組織メンバー限定」「パスワード保護」から選べ、必要に応じて Google Drive にもエクスポートできます。",
  },
  {
    q: "文字起こしの精度や対応言語は？",
    a: "Whisper Large v3 Turbo を採用しており、日本語を含む多言語に対応します。録画完了後に自動でテキスト化され、再生画面から確認・ダウンロードできます。",
  },
  {
    q: "Notion などのドキュメントに埋め込めますか？",
    a: "Notion の埋め込みブロックに共有 URL を貼れば、再生プレーヤーがそのまま展開されます。Torea は oEmbed プロバイダとしても動作しており、対応サービスへの登録を順次進めていきます。",
  },
  {
    q: "Chrome 以外のブラウザには対応しますか？",
    a: "現時点では Chrome 拡張のみ提供しています。Chromium 系 (Edge / Arc / Brave) は同じ拡張で動作する見込みですが、公式サポート範囲は順次拡大予定です。",
  },
] as const;

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-background text-foreground">
      <BackgroundBlobs />
      <SiteHeader />

      <main className="flex flex-col">
        <Hero />
        <Features />
        <UseCases />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="fixed top-4 z-40 flex w-full justify-center px-4 md:top-6">
      <nav
        aria-label="グローバルナビゲーション"
        className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-border/40 bg-background/60 px-4 py-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] ring-1 ring-white/40 backdrop-blur-xl transition-all hover:bg-background/80 md:px-5 md:py-2.5 dark:ring-white/5"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground text-sm md:text-base"
        >
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-full bg-primary shadow-primary/30 shadow-sm"
          >
            <span className="size-1.5 rounded-full bg-primary-foreground" />
          </span>
          torea
        </Link>

        <div className="hidden items-center gap-6 text-muted-foreground text-sm md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
          無料で始める
          <ArrowRightIcon />
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative flex flex-col items-center px-6 pt-32 pb-16 text-center md:pt-44 md:pb-28">
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/70 px-3.5 py-1 font-medium text-muted-foreground text-xs shadow-sm backdrop-blur-md">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        Chrome 拡張機能でワンクリック録画
      </span>

      <h1 className="max-w-3xl font-bold font-hero text-5xl text-foreground leading-[1.04] tracking-tight md:text-7xl lg:text-[5.5rem]">
        画面を録って
        <br />
        そのまま共有
      </h1>

      <p className="mt-7 max-w-xl text-balance text-base text-muted-foreground leading-relaxed md:text-lg">
        文字で書くより、画面ごと渡したほうが速い。録画して、リンクで共有するだけ。録画中もブラウザは軽く、文字起こしまで自動で行います。
      </p>

      <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/dashboard"
          className={buttonVariants({
            size: "lg",
            className:
              "w-full shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 sm:w-auto",
          })}
        >
          無料で始める
          <ArrowRightIcon />
        </Link>
        <a
          href="#features"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className:
              "w-full border-border/60 bg-card/70 backdrop-blur-md transition-transform hover:-translate-y-0.5 sm:w-auto",
          })}
        >
          機能を見る
        </a>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-semibold text-3xl text-foreground leading-tight tracking-tight md:text-5xl">
          録画して、共有して、対話する。
        </h2>
        <p className="mt-5 text-muted-foreground md:text-lg">
          必要なのは、Chrome 拡張機能とリンク 1 本。
        </p>
      </div>

      <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className={`group cursor-default rounded-[2rem] border border-border/40 bg-card p-7 shadow-sm transition-colors duration-500 hover:shadow-md md:p-8 ${feature.surface}`}
          >
            <div
              className={`mb-6 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground transition-colors duration-500 ${feature.iconHover}`}
            >
              <feature.icon className="size-5" />
            </div>
            <h3 className="font-medium text-foreground text-lg">
              {feature.title}
            </h3>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              {feature.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UseCases() {
  return (
    <section
      id="use-cases"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-border/50 bg-card/70 px-3.5 py-1 font-medium text-muted-foreground text-xs shadow-sm backdrop-blur-md">
          こんなときに
        </span>
        <h2 className="mt-5 font-semibold text-3xl text-foreground leading-tight tracking-tight md:text-5xl">
          文字で伝えにくいことは、
          <br />
          画面の動きに任せて。
        </h2>
        <p className="mt-5 text-muted-foreground md:text-lg">
          動画は、テキストよりも速くて、温かい。
        </p>
      </div>

      <ul className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {USE_CASES.map((u) => (
          <li
            key={u.label}
            className="rounded-[2rem] border border-border/40 bg-card/70 p-7 shadow-sm backdrop-blur-md md:p-8"
          >
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
              {u.label}
            </span>
            <p className="mt-5 font-medium text-foreground text-lg leading-snug">
              {u.title}
            </p>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              {u.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 py-24"
    >
      <div className="mb-12 text-center">
        <h2 className="font-medium text-3xl text-foreground leading-tight tracking-tight md:text-4xl">
          よくある質問
        </h2>
      </div>

      <Accordion className="flex flex-col gap-3 overflow-visible rounded-none border-0 bg-transparent">
        {FAQ.map((item, i) => (
          <AccordionItem
            key={item.q}
            value={`item-${i}`}
            className="overflow-hidden rounded-2xl border border-border/40 not-last:border-b bg-card shadow-sm transition-colors hover:border-border/70 data-open:bg-card"
          >
            <AccordionTrigger className="px-6 py-5 text-base hover:no-underline md:text-base">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="px-6 text-muted-foreground">
              <p>{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative mx-auto w-full max-w-5xl px-6 pt-8 pb-24 md:pb-32">
      <div className="relative overflow-hidden rounded-[2.5rem] border border-border/40 bg-card px-6 py-16 text-center shadow-[0_30px_80px_-40px_rgb(0_0_0/0.2)] md:rounded-[3rem] md:px-12 md:py-24 dark:shadow-[0_30px_80px_-40px_rgb(0_0_0/0.6)]">
        <div className="absolute -top-24 -left-24 -z-10 size-72 animate-float rounded-full bg-surface-peach blur-3xl dark:bg-primary/20" />
        <div className="absolute -right-24 -bottom-24 -z-10 size-80 animate-float-slow rounded-full bg-surface-sage blur-3xl dark:bg-accent/30" />

        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary shadow-foreground/10 shadow-lg md:size-16 md:rounded-[1.25rem]">
          <span
            aria-hidden
            className="size-5 rounded-full bg-primary md:size-6"
          />
        </div>
        <h2 className="mt-8 font-medium text-3xl text-foreground leading-tight tracking-tight md:text-5xl">
          次の動画は、
          <span className="text-muted-foreground">30 秒後</span>
          に録れる。
        </h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground md:text-lg">
          ダッシュボードにサインインして、今すぐ torea を始めましょう。
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className={buttonVariants({
              size: "lg",
              className:
                "shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5",
            })}
          >
            無料で始める
            <ArrowRightIcon />
          </Link>
          <a
            href="#features"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            機能をもう一度見る
          </a>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted-foreground text-xs">
          <li className="inline-flex items-center gap-1.5">
            <FileTextIcon className="size-3.5" />
            文字起こしも無料
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheckIcon className="size-3.5" />
            組織内 / パスワード共有に対応
          </li>
          <li className="inline-flex items-center gap-1.5">
            <ZapIcon className="size-3.5" />
            録画中もブラウザが軽い
          </li>
        </ul>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-border/40 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-12 md:flex-row md:justify-between">
        <div className="flex items-center gap-2 font-medium text-foreground text-sm">
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-full bg-primary"
          >
            <span className="size-1 rounded-full bg-primary-foreground" />
          </span>
          torea
        </div>

        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} torea. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// Hero / CTA の背景を覆う大きなグラデーションブロブ。
// ライトモードでは pastel surface tokens を使い、ダークモードは brand 色を薄く重ねる。
function BackgroundBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 -right-32 size-[34rem] animate-float rounded-full bg-surface-peach blur-3xl md:size-[44rem] dark:bg-primary/15" />
      <div className="absolute -bottom-40 -left-32 size-[30rem] animate-float-slow rounded-full bg-surface-mist blur-3xl md:size-[40rem] dark:bg-accent/30" />
      <div className="absolute top-1/3 left-1/2 size-[28rem] -translate-x-1/2 animate-float-slow rounded-full bg-surface-sage opacity-60 blur-3xl md:size-[36rem] dark:bg-secondary/10" />
    </div>
  );
}
