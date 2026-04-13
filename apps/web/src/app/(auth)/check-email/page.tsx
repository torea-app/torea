import { Alert, AlertDescription } from "@screenbase/ui/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@screenbase/ui/components/ui/card";
import { InfoIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ResendVerificationButton } from "./_features/resend-verification-button";

async function CheckEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center justify-items-center text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="size-6 text-primary" />
        </div>
        <CardTitle className="text-xl">メールをご確認ください</CardTitle>
        <CardDescription>
          ご登録いただいたメールアドレスに確認メールを送信しました。
          <br />
          メール内のリンクをクリックして、アカウントの登録を完了してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <InfoIcon className="size-4" />
          <AlertDescription>
            メールが届かない場合は、迷惑メールフォルダをご確認ください。
          </AlertDescription>
        </Alert>

        {email && <ResendVerificationButton email={email} />}

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

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <Suspense>
      <CheckEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
