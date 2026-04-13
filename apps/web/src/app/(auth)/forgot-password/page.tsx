import { Suspense } from "react";
import { ForgotPasswordForm } from "./_features/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
