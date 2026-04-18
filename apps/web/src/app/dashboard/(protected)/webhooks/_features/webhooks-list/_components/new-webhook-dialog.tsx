"use client";

import { Button } from "@torea/ui/components/ui/button";
import { Checkbox } from "@torea/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@torea/ui/components/ui/dialog";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { Textarea } from "@torea/ui/components/ui/textarea";
import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWebhookEndpoint } from "../../../_lib/actions";
import type { WebhookEventName } from "../../../_lib/types";
import { SecretRevealedDialog } from "./secret-revealed-dialog";
import {
  CATEGORY_LABELS,
  WEBHOOK_EVENT_OPTIONS,
  type WebhookEventOption,
} from "./webhook-event-options";

const groupedEvents = WEBHOOK_EVENT_OPTIONS.reduce<
  Record<WebhookEventOption["category"], WebhookEventOption[]>
>(
  (acc, opt) => {
    if (!acc[opt.category]) acc[opt.category] = [];
    acc[opt.category].push(opt);
    return acc;
  },
  {} as Record<WebhookEventOption["category"], WebhookEventOption[]>,
);

export function NewWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<WebhookEventName>>(new Set());
  const [pending, startTransition] = useTransition();
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  function reset() {
    setName("");
    setUrl("");
    setDescription("");
    setSelected(new Set());
  }

  function toggleEvent(name: WebhookEventName) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectCategory(
    category: WebhookEventOption["category"],
    enable: boolean,
  ) {
    setSelected((prev) => {
      const next = new Set(prev);
      const names = (groupedEvents[category] ?? []).map((o) => o.name);
      for (const n of names) {
        if (enable) next.add(n);
        else next.delete(n);
      }
      return next;
    });
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error("少なくとも 1 つのイベントを選択してください");
      return;
    }
    startTransition(async () => {
      const result = await createWebhookEndpoint({
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || undefined,
        events: Array.from(selected),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Webhook を作成しました");
      setRevealedSecret(result.data.secret);
      setOpen(false);
      reset();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button>
              <PlusIcon className="mr-1 size-4" />
              新規作成
            </Button>
          }
        />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Webhook を新規作成</DialogTitle>
            <DialogDescription>
              録画完了などのイベントが発生したときに、指定した URL に
              HMAC-SHA256 署名付きで HTTPS POST します。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">名前</Label>
              <Input
                id="webhook-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: Slack 通知"
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">配信先 URL</Label>
              <Input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks/torea"
                required
                maxLength={2048}
              />
              <p className="text-muted-foreground text-xs">
                HTTPS のみ。プライベート IP は指定できません。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-description">説明 (任意)</Label>
              <Textarea
                id="webhook-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="この Webhook の用途をメモできます"
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>購読イベント</Label>
              <div className="space-y-3 rounded-md border p-3">
                {(
                  Object.keys(groupedEvents) as WebhookEventOption["category"][]
                ).map((category) => {
                  const events = groupedEvents[category];
                  const allSelected = events.every((e) => selected.has(e.name));
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => selectCategory(category, !allSelected)}
                        >
                          {allSelected ? "全て解除" : "全て選択"}
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {events.map((opt) => {
                          const id = `event-${opt.name}`;
                          return (
                            <div
                              key={opt.name}
                              className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                            >
                              <Checkbox
                                id={id}
                                checked={selected.has(opt.name)}
                                onCheckedChange={() => toggleEvent(opt.name)}
                              />
                              <Label
                                htmlFor={id}
                                className="flex-1 cursor-pointer font-normal"
                              >
                                {opt.label}
                              </Label>
                              <code className="text-muted-foreground text-xs">
                                {opt.name}
                              </code>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                {selected.size} 件のイベントを選択中
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {revealedSecret && (
        <SecretRevealedDialog
          open={revealedSecret !== null}
          onClose={() => setRevealedSecret(null)}
          secret={revealedSecret}
        />
      )}
    </>
  );
}
