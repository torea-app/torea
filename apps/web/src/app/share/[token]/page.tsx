import { env } from "@torea/env/web";
import type { Metadata } from "next";
import { ShareContainer } from "./_containers/share-container";
import { getShareMetadata } from "./_lib/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const result = await getShareMetadata(token);

  if (!result.success) {
    return { title: "動画が見つかりません" };
  }

  const metadata = result.data;
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
  const sharePageUrl = `${env.NEXT_PUBLIC_APP_URL}/share/${encodeURIComponent(token)}`;
  const oembedEndpoint = `${env.NEXT_PUBLIC_SERVER_URL}/api/oembed?url=${encodeURIComponent(sharePageUrl)}&format=json`;

  // generateMetadata で取得したメタデータと title が同期するよう、
  // oembed の title パラメータは含めず href のみ宣言する。
  return (
    <>
      <link
        rel="alternate"
        type="application/json+oembed"
        href={oembedEndpoint}
      />
      <ShareContainer token={token} />
    </>
  );
}

export const dynamic = "force-dynamic";
