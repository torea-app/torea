import Link from "next/link";
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="font-semibold text-lg">
          Torea
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            料金
          </Link>
          <Link
            href="/sign-in"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ログイン
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-6 py-8 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Torea</p>
      </footer>
    </div>
  );
}
