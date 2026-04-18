"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { MailIcon } from "lucide-react";
import Link from "next/link";
import { useForgotPasswordForm } from "./use-form";

export function ForgotPasswordForm() {
  const { form, sent } = useForgotPasswordForm();

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center justify-items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailIcon className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">メールを送信しました</CardTitle>
          <CardDescription>
            パスワードリセット用のリンクをメールで送信しました。
            <br />
            メール内のリンクをクリックして、新しいパスワードを設定してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Link
              href="/sign-in"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              ログインページに戻る
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-2 text-center font-bold text-3xl">
        パスワードをお忘れですか？
      </h1>
      <p className="mb-6 text-center text-muted-foreground text-sm">
        登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
      </p>

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

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "送信中..." : "リセットリンクを送信"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Link href="/sign-in" className="underline-offset-4 hover:underline">
          ログインページに戻る
        </Link>
      </div>
    </div>
  );
}
