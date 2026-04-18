"use client";

import { Button } from "@torea/ui/components/ui/button";
import { Checkbox } from "@torea/ui/components/ui/checkbox";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { Textarea } from "@torea/ui/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateWebhookEndpoint } from "../../../_lib/actions";
import type { WebhookEndpoint, WebhookEventName } from "../../../_lib/types";
import {
  CATEGORY_LABELS,
  WEBHOOK_EVENT_OPTIONS,
  type WebhookEventOption,
} from "../../webhooks-list/_components/webhook-event-options";

const grouped = WEBHOOK_EVENT_OPTIONS.reduce<
  Record<WebhookEventOption["category"], WebhookEventOption[]>
>(
  (acc, opt) => {
    if (!acc[opt.category]) acc[opt.category] = [];
    acc[opt.category].push(opt);
    return acc;
  },
  {} as Record<WebhookEventOption["category"], WebhookEventOption[]>,
);

export function EditForm({ endpoint }: { endpoint: WebhookEndpoint }) {
  const router = useRouter();
  const [name, setName] = useState(endpoint.name);
  const [url, setUrl] = useState(endpoint.url);
  const [description, setDescription] = useState(endpoint.description ?? "");
  const [events, setEvents] = useState<Set<WebhookEventName>>(
    new Set(endpoint.events),
  );
  const [pending, startTransition] = useTransition();

  function toggle(name: WebhookEventName) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (events.size === 0) {
      toast.error("少なくとも 1 つのイベントを選択してください");
      return;
    }
    startTransition(async () => {
      const result = await updateWebhookEndpoint(endpoint.id, {
        name: name.trim(),
        url: url.trim(),
        description: description.trim() || null,
        events: Array.from(events),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Webhook を更新しました");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="edit-name">名前</Label>
        <Input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-url">配信先 URL</Label>
        <Input
          id="edit-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          maxLength={2048}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-description">説明</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>購読イベント</Label>
        <div className="space-y-3 rounded-md border p-3">
          {(Object.keys(grouped) as WebhookEventOption["category"][]).map(
            (category) => (
              <div key={category} className="space-y-2">
                <span className="font-medium text-sm">
                  {CATEGORY_LABELS[category]}
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {grouped[category].map((opt) => {
                    const id = `edit-event-${opt.name}`;
                    return (
                      <div
                        key={opt.name}
                        className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          id={id}
                          checked={events.has(opt.name)}
                          onCheckedChange={() => toggle(opt.name)}
                        />
                        <Label
                          htmlFor={id}
                          className="flex-1 cursor-pointer font-normal"
                        >
                          {opt.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "保存中..." : "保存"}
      </Button>
    </form>
  );
}
