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
  CircleDotIcon,
  GaugeIcon,
  Link2Icon,
  MessageSquareTextIcon,
  PlayIcon,
  ShieldCheckIcon,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "#features", label: "機能" },
  { href: "#faq", label: "FAQ" },
] as const;

const FEATURES = [
  {
    icon: VideoIcon,
    title: "ワンクリックでタブ録画",
    body: "Chrome 拡張を開いて録画開始。タブ音声とマイクをその場でミックスし、録画中に R2 へリアルタイムアップロードします。",
    tint: "group-hover:bg-accent/60",
  },
  {
    icon: MessageSquareTextIcon,
    title: "タイムスタンプ付きコメント",
    body: "動画の「この秒」に直接コメント。スレッドで返信し、レビューの往復を非同期で終わらせます。",
    tint: "group-hover:bg-primary/10",
  },
  {
    icon: Link2Icon,
    title: "共有と分析を 1 本のリンクに",
    body: "組織メンバー限定・パスワード保護・公開を選べる共有リンク。誰がどこまで観たかも計測します。",
    tint: "group-hover:bg-secondary/10",
  },
] as const;

const FAQ = [
  {
    q: "利用は無料ですか？",
    a: "個人利用の基本機能は無料で提供しています。組織・Webhook・詳細分析などは有料プランに含まれる予定です。",
  },
  {
    q: "録画データはどこに保存されますか？",
    a: "Cloudflare R2（オブジェクトストレージ）にマルチパートアップロードされます。共有範囲は共有リンクごとに組織メンバー限定・パスワード保護・公開から選択できます。",
  },
  {
    q: "Chrome 以外のブラウザには対応しますか？",
    a: "現時点では Chrome 拡張のみ提供しています。Chromium 系（Edge / Arc / Brave）は同じ拡張で動作する見込みですが、公式サポート範囲は今後拡張予定です。",
  },
  {
    q: "録画時間に上限はありますか？",
    a: "録画中はチャンク単位でアップロードされるため、端末メモリで長時間録画を抱え込みません。プランごとの上限は後日ご案内します。",
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
        className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-border/60 bg-background/70 px-4 py-2 shadow-sm backdrop-blur-xl md:px-5 md:py-2.5"
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground text-sm md:text-base"
        >
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-full bg-primary"
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
    <section className="relative flex flex-col items-center px-6 pt-32 pb-16 text-center md:pt-40 md:pb-24">
      <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 font-medium text-muted-foreground text-xs backdrop-blur-sm">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        Chrome 拡張でワンクリック録画
      </span>

      <h1 className="max-w-3xl font-hero font-semibold text-5xl text-foreground leading-[1.05] tracking-tight md:text-7xl">
        画面を録る、
        <br className="hidden md:block" />
        <span className="text-muted-foreground">そのまま</span>共有する。
      </h1>

      <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground leading-relaxed md:text-lg">
        torea
        は、ブラウザタブの録画からチームへの共有、タイムスタンプコメント、視聴分析までをひとつにまとめた画面録画プラットフォームです。
      </p>

      <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/dashboard"
          className={buttonVariants({
            size: "lg",
            className: "w-full sm:w-auto",
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
            className: "w-full sm:w-auto",
          })}
        >
          機能を見る
        </a>
      </div>

      <HeroMockup />
    </section>
  );
}

// Hero 下に配置する、CSS のみで構成した抽象ブラウザモックアップ。
// 実画像を差し込む場合は、この関数全体を <Image> + 1600x1000 前後の
// プロダクトスクリーンショット (light/dark 両テーマ対応) に置き換える想定。
function HeroMockup() {
  return (
    <div className="relative mt-16 w-full max-w-5xl" aria-hidden>
      <div className="absolute -top-8 -left-16 -z-10 size-72 rounded-full bg-primary/20 blur-3xl md:size-96" />
      <div className="absolute -right-20 -bottom-12 -z-10 size-80 rounded-full bg-accent/60 blur-3xl md:size-[28rem] dark:bg-accent/40" />

      <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xl">
        {/* ブラウザクローム */}
        <div className="flex items-center gap-2 border-border/60 border-b bg-muted/60 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-primary/70" />
            <span className="size-2.5 rounded-full bg-chart-2/70" />
          </div>
          <div className="mx-auto flex max-w-md flex-1 items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-muted-foreground text-xs">
            <CircleDotIcon className="size-3 text-destructive" />
            <span className="font-mono">torea.app / recording</span>
          </div>
          <span className="w-12" />
        </div>

        {/* 録画キャンバス */}
        <div className="relative grid gap-4 p-4 md:grid-cols-[1fr_280px] md:p-6">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-secondary/90 via-secondary to-secondary/70 text-secondary-foreground">
            {/* 録画インジケーター */}
            <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-background/90 px-2.5 py-1 font-medium text-foreground text-xs shadow-sm backdrop-blur">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-destructive" />
              </span>
              REC 00:42
            </div>

            {/* 再生ボタン風ビジュアル */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex size-20 items-center justify-center rounded-full bg-primary-foreground/10 backdrop-blur-md md:size-24">
                <PlayIcon className="size-8 fill-primary-foreground text-primary-foreground md:size-10" />
              </div>
            </div>

            {/* タイムラインとコメントピン */}
            <div className="absolute right-4 bottom-4 left-4 space-y-2">
              <div className="relative h-1 rounded-full bg-primary-foreground/20">
                <div className="h-full w-2/5 rounded-full bg-primary" />
                <span className="absolute -top-1 left-[35%] size-3 -translate-x-1/2 rounded-full border-2 border-primary-foreground bg-primary shadow" />
                <span className="absolute -top-1 left-[62%] size-3 -translate-x-1/2 rounded-full border-2 border-primary-foreground bg-chart-4 shadow" />
              </div>
              <div className="flex items-center justify-between text-primary-foreground/70 text-xs">
                <span className="font-mono">00:42 / 01:48</span>
                <span className="hidden sm:inline">1080p · MP4</span>
              </div>
            </div>
          </div>

          {/* サイドパネル: コメント */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs">
                  NY
                </span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-xs">@naoki</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    00:18
                  </p>
                </div>
              </div>
              <p className="mt-2 text-left text-muted-foreground text-xs leading-relaxed">
                ここのボタン、押せることが分かりにくいかも。
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-chart-4/20 text-chart-4 text-xs">
                  MK
                </span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-xs">@miki</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    01:07
                  </p>
                </div>
              </div>
              <p className="mt-2 text-left text-muted-foreground text-xs leading-relaxed">
                反映されました！再確認お願いします。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-semibold text-3xl text-foreground leading-tight tracking-tight md:text-4xl">
          録画して、共有して、対話する。
        </h2>
        <p className="mt-4 text-muted-foreground">
          必要なのは、Chrome 拡張 1 つとリンク 1 本。
        </p>
      </div>

      <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <li
            key={feature.title}
            className="group rounded-3xl border border-border/60 bg-card p-6 shadow-xs transition-colors duration-300 hover:border-border md:p-8"
          >
            <div
              className={`mb-5 flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground transition-colors duration-300 ${feature.tint}`}
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

function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 py-24"
    >
      <div className="mb-10 text-center">
        <h2 className="font-medium text-3xl text-foreground leading-tight tracking-tight md:text-4xl">
          よくある質問
        </h2>
      </div>

      <Accordion className="border-border/70 bg-card/60">
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`item-${i}`}>
            <AccordionTrigger className="px-5 py-5 text-base md:text-base">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="px-5 text-muted-foreground">
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
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card px-6 py-16 text-center md:px-12 md:py-20">
        <div className="absolute -top-20 -left-20 -z-10 size-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 -z-10 size-72 rounded-full bg-accent/60 blur-3xl dark:bg-accent/30" />

        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary shadow-md">
          <VideoIcon className="size-5 text-primary-foreground" />
        </div>
        <h2 className="mt-6 font-medium text-3xl text-foreground leading-tight tracking-tight md:text-4xl">
          次の動画は、30 秒後に録れる。
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          ダッシュボードにサインインして、今すぐ torea を始めましょう。
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
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

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted-foreground text-xs">
          <li className="inline-flex items-center gap-1.5">
            <ShieldCheckIcon className="size-3.5" />
            組織メンバー限定の共有に対応
          </li>
          <li className="inline-flex items-center gap-1.5">
            <GaugeIcon className="size-3.5" />
            リアルタイムアップロード
          </li>
        </ul>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-border/60 border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-10 md:flex-row md:justify-between">
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
// ダークモードでは透明度を下げて眩しさを抑えつつ、primary/accent/secondary
// のブランドトーンをページ全体に薄く漂わせる。
function BackgroundBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 -right-40 size-[40rem] rounded-full bg-accent/50 blur-3xl dark:bg-accent/20" />
      <div className="absolute -bottom-40 -left-40 size-[36rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/15" />
    </div>
  );
}
