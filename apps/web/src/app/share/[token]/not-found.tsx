import { buttonVariants } from "@screenbase/ui/components/ui/button";
import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="font-semibold text-2xl">共有リンクが見つかりません</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        このリンクは無効か、削除されている可能性があります。
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", className: "mt-6" })}
      >
        トップへ戻る
      </Link>
    </div>
  );
}
