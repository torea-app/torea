"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { acceptInvitation, rejectInvitation } from "../../_lib/actions";

export function AcceptInvitation({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    const result = await acceptInvitation(invitationId);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("招待を承認しました");
    router.push("/dashboard");
  };

  const handleReject = async () => {
    setLoading(true);
    const result = await rejectInvitation(invitationId);
    setLoading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("招待を拒否しました");
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>組織への招待</CardTitle>
          <CardDescription>組織への参加に招待されています。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            招待を承認して組織に参加するか、拒否してください。
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={loading}
            className="flex-1"
          >
            拒否
          </Button>
          <Button onClick={handleAccept} disabled={loading} className="flex-1">
            {loading ? "処理中..." : "承認"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
