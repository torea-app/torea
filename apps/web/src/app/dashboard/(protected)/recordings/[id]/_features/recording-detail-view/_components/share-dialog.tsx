"use client";

import { Button } from "@screenbase/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@screenbase/ui/components/ui/dialog";
import { Input } from "@screenbase/ui/components/ui/input";
import { Label } from "@screenbase/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@screenbase/ui/components/ui/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@screenbase/ui/components/ui/radio-group";
import { Separator } from "@screenbase/ui/components/ui/separator";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  Globe2Icon,
  LockIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ShareLink } from "../../../../_lib/types";

type Props = {
  recordingId: string;
};

type ShareType = "org_members" | "password_protected";

export function ShareDialog({ recordingId }: Props) {
  const [open, setOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [type, setType] = useState<ShareType>("org_members");
  const [password, setPassword] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedEmbedId, setCopiedEmbedId] = useState<string | null>(null);

  const loadShareLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.api.shares.$get({ query: { recordingId } });
      if (!res.ok) {
        toast.error("共有リンクの取得に失敗しました");
        return;
      }
      const data = await res.json();
      setShareLinks(data.shareLinks as ShareLink[]);
    } finally {
      setIsLoading(false);
    }
  }, [recordingId]);

  // ダイアログを開いた時に共有リンク一覧を取得
  useEffect(() => {
    if (!open) return;
    void loadShareLinks();
  }, [open, loadShareLinks]);

  async function handleCreate() {
    if (type === "password_protected" && password.trim().length === 0) {
      toast.error("パスワードを入力してください");
      return;
    }

    setIsCreating(true);
    try {
      const body =
        type === "org_members"
          ? { recordingId, type: "org_members" as const }
          : { recordingId, type: "password_protected" as const, password };

      const res = await api.api.shares.$post({ json: body });
      if (!res.ok) {
        toast.error("共有リンクの作成に失敗しました");
        return;
      }
      toast.success("共有リンクを作成しました");
      setPassword("");
      await loadShareLinks();
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(shareId: string) {
    const res = await api.api.shares[":shareId"].$delete({
      param: { shareId },
    });
    if (!res.ok) {
      toast.error("共有リンクの削除に失敗しました");
      return;
    }
    toast.success("共有リンクを削除しました");
    setShareLinks((prev) => prev.filter((l) => l.id !== shareId));
  }

  function getShareUrl(shareId: string): string {
    return `${window.location.origin}/share/${shareId}`;
  }

  async function handleCopy(shareId: string) {
    try {
      await navigator.clipboard.writeText(getShareUrl(shareId));
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("コピーに失敗しました");
    }
  }

  function getEmbedUrl(shareId: string): string {
    return `${window.location.origin}/embed/${shareId}`;
  }

  function getEmbedCode(shareId: string): string {
    const embedUrl = getEmbedUrl(shareId);
    return `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  }

  function getResponsiveEmbedCode(shareId: string): string {
    const embedUrl = getEmbedUrl(shareId);
    return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;"><iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
  }

  async function handleCopyEmbed(shareId: string, responsive: boolean) {
    try {
      const code = responsive
        ? getResponsiveEmbedCode(shareId)
        : getEmbedCode(shareId);
      await navigator.clipboard.writeText(code);
      setCopiedEmbedId(shareId);
      toast.success(
        responsive
          ? "レスポンシブ埋め込みコードをコピーしました"
          : "埋め込みコードをコピーしました",
      );
      setTimeout(() => setCopiedEmbedId(null), 2000);
    } catch {
      toast.error("コピーに失敗しました");
    }
  }

  function getTypeLabel(linkType: ShareType): string {
    return linkType === "org_members" ? "組織メンバーのみ" : "パスワード保護";
  }

  function getTypeIcon(linkType: ShareType) {
    return linkType === "org_members" ? (
      <Globe2Icon className="size-4 shrink-0" />
    ) : (
      <LockIcon className="size-4 shrink-0" />
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Share2Icon className="mr-2 size-4" />
        共有
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>動画を共有</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 新規作成フォーム */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>共有タイプ</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as ShareType)}
              >
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <RadioGroupItem value="org_members" id="type-org" />
                  <Label
                    htmlFor="type-org"
                    className="flex cursor-pointer items-center gap-2 font-normal"
                  >
                    <Globe2Icon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">組織メンバーのみ</div>
                      <div className="text-muted-foreground text-xs">
                        ログインが必要
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border p-3">
                  <RadioGroupItem value="password_protected" id="type-pw" />
                  <Label
                    htmlFor="type-pw"
                    className="flex cursor-pointer items-center gap-2 font-normal"
                  >
                    <LockIcon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">パスワード保護</div>
                      <div className="text-muted-foreground text-xs">
                        ログイン不要
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {type === "password_protected" && (
              <div className="space-y-1.5">
                <Label htmlFor="share-password">パスワード</Label>
                <Input
                  id="share-password"
                  type="password"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? "作成中..." : "共有リンクを作成"}
            </Button>
          </div>

          {/* 既存リンク一覧 */}
          {(isLoading || shareLinks.length > 0) && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  共有リンク一覧
                </p>
                {isLoading ? (
                  <p className="text-muted-foreground text-sm">読み込み中...</p>
                ) : (
                  <ul className="space-y-2">
                    {shareLinks.map((link) => (
                      <li
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {getTypeIcon(link.type)}
                          <span className="truncate text-sm">
                            {getTypeLabel(link.type)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(link.id)}
                            title="リンクをコピー"
                          >
                            {copiedId === link.id ? (
                              <CheckIcon className="size-3.5 text-green-600" />
                            ) : (
                              <CopyIcon className="size-3.5" />
                            )}
                          </Button>
                          <Popover>
                            <PopoverTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="埋め込みコード"
                                />
                              }
                            >
                              {copiedEmbedId === link.id ? (
                                <CheckIcon className="size-3.5 text-green-600" />
                              ) : (
                                <CodeIcon className="size-3.5" />
                              )}
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80">
                              <div className="space-y-3">
                                <p className="font-medium text-sm">
                                  埋め込みコード
                                </p>
                                <div className="space-y-2">
                                  <div className="rounded-md bg-muted p-2">
                                    <code className="block break-all text-muted-foreground text-xs">
                                      {getEmbedCode(link.id)}
                                    </code>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                      onClick={() =>
                                        handleCopyEmbed(link.id, false)
                                      }
                                    >
                                      <CopyIcon className="mr-1.5 size-3" />
                                      固定サイズ
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1"
                                      onClick={() =>
                                        handleCopyEmbed(link.id, true)
                                      }
                                    >
                                      <CopyIcon className="mr-1.5 size-3" />
                                      レスポンシブ
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(link.id)}
                            title="共有リンクを削除"
                          >
                            <Trash2Icon className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
