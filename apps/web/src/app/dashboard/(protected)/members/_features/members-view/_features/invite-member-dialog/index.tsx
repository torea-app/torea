"use client";

import { Button } from "@torea/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@torea/ui/components/ui/dialog";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@torea/ui/components/ui/select";
import { PlusIcon } from "lucide-react";
import { useRef } from "react";
import { useInviteMemberForm } from "./use-form";

export function InviteMemberDialog() {
  const closeRef = useRef<HTMLButtonElement>(null);

  const form = useInviteMemberForm(() => {
    closeRef.current?.click();
  });

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon className="mr-2 size-4" />
        メンバーを招待
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メンバーを招待</DialogTitle>
          <DialogDescription>
            招待メールを送信して、組織に新しいメンバーを追加します。
          </DialogDescription>
        </DialogHeader>
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
                  placeholder="member@example.com"
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

          <form.Field name="role">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>ロール</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) =>
                    v && field.handleChange(v as "member" | "admin")
                  }
                  items={[
                    { value: "member", label: "メンバー" },
                    { value: "admin", label: "管理者" },
                  ]}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="ロールを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">メンバー</SelectItem>
                    <SelectItem value="admin">管理者</SelectItem>
                  </SelectContent>
                </Select>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500 text-sm">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <DialogClose
              render={<Button type="button" variant="outline" ref={closeRef} />}
            >
              キャンセル
            </DialogClose>
            <form.Subscribe
              selector={(state) =>
                [state.canSubmit, state.isSubmitting] as const
              }
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "送信中..." : "招待を送信"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
