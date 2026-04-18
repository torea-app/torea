"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Status = "verifying" | "success" | "error" | "invalid";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setStatus("invalid");
      return;
    }

    (async () => {
      try {
        const { error } = await authClient.verifyEmail({
          query: { token },
        });

        if (error) {
          setStatus("error");
          return;
        }

        setStatus("success");

        // autoSignInAfterVerification creates a session.
        // Ensure the user has an organization before redirecting.
        try {
          const { data: orgs } = await authClient.organization.list();
          if (!Array.isArray(orgs) || orgs.length === 0) {
            const { data: org } = await authClient.organization.create({
              name: "マイワークスペース",
              slug: `personal-${Date.now()}`,
            });
            if (org) {
              await authClient.organization.setActive({
                organizationId: org.id,
              });
            }
          } else {
            await authClient.organization.setActive({
              organizationId: orgs[0].id,
            });
          }
        } catch (e) {
          console.error("[verify-email] Failed to setup organization:", e);
        }

        router.push("/dashboard");
      } catch {
        setStatus("error");
      }
    })();
  }, [searchParams, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center justify-items-center text-center">
        {status === "verifying" && (
          <>
            <Loader2Icon className="mx-auto mb-2 size-10 animate-spin text-primary" />
            <CardTitle className="text-xl">
              メールアドレスを確認しています...
            </CardTitle>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2Icon className="mx-auto mb-2 size-10 text-green-600" />
            <CardTitle className="text-xl">
              メールアドレスが確認されました
            </CardTitle>
          </>
        )}
        {status === "error" && (
          <>
            <XCircleIcon className="mx-auto mb-2 size-10 text-destructive" />
            <CardTitle className="text-xl">
              確認リンクが無効または期限切れです
            </CardTitle>
          </>
        )}
        {status === "invalid" && (
          <>
            <XCircleIcon className="mx-auto mb-2 size-10 text-destructive" />
            <CardTitle className="text-xl">無効なリンクです</CardTitle>
          </>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "success" && (
          <p className="text-center text-muted-foreground text-sm">
            ダッシュボードに移動しています...
          </p>
        )}

        {(status === "error" || status === "invalid") && (
          <div className="flex flex-col gap-2">
            <Button className="w-full" render={<Link href="/check-email" />}>
              確認メールを再送する
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
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
