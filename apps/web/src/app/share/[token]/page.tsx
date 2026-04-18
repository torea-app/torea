import { env } from "@torea/env/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgMembersView } from "./_components/org-members-view";
import { PasswordProtectedView } from "./_components/password-protected-view";
import type { ShareMetadata } from "./_lib/types";

async function getShareMetadata(token: string): Promise<ShareMetadata | null> {
  try {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return res.json() as Promise<ShareMetadata>;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const metadata = await getShareMetadata(token);

  if (!metadata) {
    return { title: "動画が見つかりません" };
  }

  const thumbnailUrl = `${env.NEXT_PUBLIC_SERVER_URL}/api/share/${encodeURIComponent(token)}/thumbnail`;

  return {
    title: `${metadata.recordingTitle} | Torea`,
    openGraph: {
      title: metadata.recordingTitle,
      type: "video.other",
      siteName: "Torea",
      images: [
        {
          url: thumbnailUrl,
          width: 640,
          height: 360,
          type: "image/webp",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.recordingTitle,
      images: [thumbnailUrl],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const metadata = await getShareMetadata(token);

  if (!metadata) {
    notFound();
  }

  const sharePageUrl = `${env.NEXT_PUBLIC_APP_URL}/share/${encodeURIComponent(token)}`;
  const oembedEndpoint = `${env.NEXT_PUBLIC_SERVER_URL}/api/oembed?url=${encodeURIComponent(sharePageUrl)}&format=json`;

  return (
    <>
      <link
        rel="alternate"
        type="application/json+oembed"
        href={oembedEndpoint}
        title={metadata.recordingTitle}
      />
      {metadata.type === "org_members" ? (
        <OrgMembersView token={token} metadata={metadata} />
      ) : (
        <PasswordProtectedView token={token} metadata={metadata} />
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
