import Link from "next/link";

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* 最小限のヘッダー（ブランドロゴのみ） */}
      <header className="border-b px-6 py-3">
        <Link
          href="/"
          className="font-semibold text-foreground text-sm transition-colors hover:text-foreground/80"
        >
          Torea
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
