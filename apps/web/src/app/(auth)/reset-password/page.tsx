import { Suspense } from "react";
import { ResetPasswordForm } from "./_features/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
