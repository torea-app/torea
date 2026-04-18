import { env } from "@torea/env/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmbedOrgMembersView } from "./_components/embed-org-members-view";
import { EmbedPasswordView } from "./_components/embed-password-view";
import type { EmbedMetadata } from "./_lib/types";

async function getEmbedMetadata(token: string): Promise<EmbedMetadata | null> {
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return res.json() as Promise<EmbedMetadata>;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const embedMetadata = await getEmbedMetadata(token);

  if (!embedMetadata) {
    notFound();
  }

  if (embedMetadata.type === "org_members") {
    return <EmbedOrgMembersView token={token} metadata={embedMetadata} />;
  }

  return <EmbedPasswordView token={token} metadata={embedMetadata} />;
}

export const dynamic = "force-dynamic";
