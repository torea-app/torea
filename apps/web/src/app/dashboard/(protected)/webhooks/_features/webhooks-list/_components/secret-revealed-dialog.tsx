"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@torea/ui/components/ui/alert-dialog";
import { Button } from "@torea/ui/components/ui/button";
import { Checkbox } from "@torea/ui/components/ui/checkbox";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { CheckIcon, ClipboardIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  secret: string;
  title?: string;
  description?: string;
};

/**
 * 作成直後・rotate 直後にのみ平文 secret を表示する AlertDialog。
 * 「コピーしました」のチェックを入れないと閉じられない。
 */
export function SecretRevealedDialog({
  open,
  onClose,
  secret,
  title = "Webhook が作成されました",
  description = "以下の署名シークレットはこの画面でのみ表示されます。安全な場所に保存してください。一度閉じると二度と表示できません。",
}: Props) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("シークレットをコピーしました");
    } catch {
      toast.error("クリップボードへのコピーに失敗しました");
    }
  }

  function handleClose() {
    setCopied(false);
    setAcknowledged(false);
    onClose();
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <Label htmlFor="webhook-secret">署名シークレット</Label>
          <div className="flex gap-2">
            <Input
              id="webhook-secret"
              value={secret}
              readOnly
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={copySecret}>
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <ClipboardIcon className="size-4" />
              )}
              <span className="ml-1">コピー</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              id="secret-acknowledged"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
            />
            <Label htmlFor="secret-acknowledged" className="font-normal">
              シークレットを安全な場所に保存しました
            </Label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={handleClose} disabled={!acknowledged}>
            閉じる
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
