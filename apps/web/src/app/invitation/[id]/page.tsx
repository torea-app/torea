import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AcceptInvitation } from "./_features/accept-invitation";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session =
    cookieStore.get("better-auth.session_token") ??
    cookieStore.get("__Secure-better-auth.session_token");

  if (!session) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/invitation/${id}`)}`);
  }

  return <AcceptInvitation invitationId={id} />;
}
