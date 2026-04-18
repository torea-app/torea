import { SidebarInset, SidebarProvider } from "@torea/ui/components/ui/sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider } from "@/components/auth-provider";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session =
    cookieStore.get("better-auth.session_token") ??
    cookieStore.get("__Secure-better-auth.session_token");
  if (!session) {
    redirect("/sign-in");
  }

  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
