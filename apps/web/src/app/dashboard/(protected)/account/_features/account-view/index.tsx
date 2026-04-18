"use client";

import { Separator } from "@torea/ui/components/ui/separator";
import { useAuth } from "@/components/auth-provider";
import { PasswordForm } from "./_features/password-form";
import { ProfileForm } from "./_features/profile-form";
import { ThemeSelector } from "./_features/theme-selector";

export function AccountView() {
  const { session } = useAuth();

  if (!session) {
    return null;
  }

  return (
    <div className="max-w-lg space-y-8">
      <section className="space-y-4">
        <h2 className="font-semibold text-lg">プロフィール</h2>
        <ProfileForm key={session.user.id} currentName={session.user.name} />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-semibold text-lg">外観</h2>
        <ThemeSelector />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-semibold text-lg">セキュリティ</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
