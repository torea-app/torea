import { Suspense } from "react";
import { SignUpForm } from "./_features/sign-up-form";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
