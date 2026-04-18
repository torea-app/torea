import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { PuzzleIcon, SparklesIcon, VideoIcon } from "lucide-react";
import Link from "next/link";

/**
 * 初見ユーザー向けの 3 ステップ導線。
 * Chrome 拡張の公開 URL は NEXT_PUBLIC_CHROME_EXTENSION_URL で差し替え可能。
 * 未設定時は "#" にフォールバックし、ストア公開後に env で上書きする運用。
 */
export function OnboardingEmptyState() {
  // TODO: Chrome ウェブストア公開後、NEXT_PUBLIC_CHROME_EXTENSION_URL を本番 env に設定する。
  const extensionUrl = process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL ?? "#";

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-primary" />
          Torea へようこそ
        </CardTitle>
        <CardDescription>
          Chrome 拡張機能をインストールして、最初の録画を作成しましょう。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="list-inside list-decimal space-y-2 text-muted-foreground text-sm">
          <li>Chrome ウェブストアから拡張機能をインストール</li>
          <li>ブラウザ右上のアイコンから「録画開始」</li>
          <li>録画完了後、この画面に戻ると統計が表示されます</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={
              // biome-ignore lint/a11y/useAnchorContent: children は Button 側から合成される
              <a
                href={extensionUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <PuzzleIcon />
            Chrome 拡張をインストール
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/dashboard/recordings" />}
          >
            <VideoIcon />
            録画一覧へ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
