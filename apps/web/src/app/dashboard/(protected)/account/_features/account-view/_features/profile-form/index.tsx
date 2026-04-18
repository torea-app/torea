"use client";

import { Button } from "@torea/ui/components/ui/button";
import { Input } from "@torea/ui/components/ui/input";
import { Label } from "@torea/ui/components/ui/label";
import { useProfileForm } from "./use-form";

export function ProfileForm({ currentName }: { currentName: string }) {
  const form = useProfileForm(currentName);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="profile-name">名前</Label>
            <Input
              id="profile-name"
              maxLength={100}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={error?.message} className="text-destructive text-sm">
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
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "保存中..." : "保存"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
