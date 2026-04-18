import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PageHeader } from "@/components/page-header";
import { WebhookDetailContainer } from "../_containers/webhook-detail-container";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WebhookDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        items={[
          { label: "設定" },
          { label: "Webhook", href: "/dashboard/webhooks" },
          { label: "詳細" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Suspense fallback={<LoadingSkeleton />}>
          <WebhookDetailContainer id={id} />
        </Suspense>
      </div>
    </>
  );
}
