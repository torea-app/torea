import { Suspense } from "react";
import { SignInForm } from "./_features/sign-in-form";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
