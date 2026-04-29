import type { Metadata } from "next";
import { EmbedContainer } from "./_containers/embed-container";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EmbedContainer token={token} />;
}

export const dynamic = "force-dynamic";
