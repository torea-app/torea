"use client";

import { Button } from "@screenbase/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@screenbase/ui/components/ui/card";
import { Input } from "@screenbase/ui/components/ui/input";
import { Label } from "@screenbase/ui/components/ui/label";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useResetPasswordForm } from "./use-form";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  if (!token || error) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center justify-items-center text-center">
          <XCircleIcon className="mx-auto mb-2 size-10 text-destructive" />
          <CardTitle className="text-xl">
            リセットリンクが無効または期限切れです
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              nativeButton={false}
              render={<Link href="/forgot-password" />}
            >
              リセットリンクを再送する
            </Button>
            <div className="text-center">
              <Link
                href="/sign-in"
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                ログインページに戻る
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <ResetPasswordFormInner token={token} />;
}

function ResetPasswordFormInner({ token }: { token: string }) {
  const { form, success } = useResetPasswordForm(token);

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="items-center justify-items-center text-center">
          <CheckCircle2Icon className="mx-auto mb-2 size-10 text-green-600" />
          <CardTitle className="text-xl">パスワードが変更されました</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            ログインページへ
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md p-6">
      <h1 className="mb-2 text-center font-bold text-3xl">
        新しいパスワードを設定
      </h1>
      <p className="mb-6 text-center text-muted-foreground text-sm">
        新しいパスワードを入力してください。
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="password">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>新しいパスワード</Label>
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

        <form.Field name="confirmPassword">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>パスワードの確認</Label>
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

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "変更中..." : "パスワードを変更"}
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
