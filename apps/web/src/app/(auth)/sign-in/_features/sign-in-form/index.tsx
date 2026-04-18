"use client";

import { Button } from "@torea/ui/components/ui/button";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSignInForm } from "./use-form";

export function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined;
  const form = useSignInForm(callbackUrl);

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">おかえりなさい</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>メールアドレス</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-red-500 text-sm">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>パスワード</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-red-500 text-sm">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </form.Field>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            パスワードをお忘れですか？
          </Link>
        </div>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Link
          href={
            callbackUrl
              ? `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`
              : "/sign-up"
          }
          className="underline-offset-4 hover:underline"
        >
          アカウントをお持ちでないですか？新規登録
        </Link>
      </div>
    </div>
  );
}
