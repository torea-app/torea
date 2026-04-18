import { WebhookIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { WebhookDetailView } from "../_features/webhook-detail";
import { getWebhookEndpoint, listWebhookDeliveries } from "../_lib/queries";

export async function WebhookDetailContainer({ id }: { id: string }) {
  const endpointResult = await getWebhookEndpoint(id);
  if (!endpointResult.success) {
    if (endpointResult.error.includes("見つかりません")) {
      notFound();
    }
    return (
      <EmptyState
        icon={<WebhookIcon className="size-12" />}
        title="Webhook を取得できません"
        description={
          endpointResult.error.includes("権限")
            ? "管理者 (owner / admin) のみが Webhook を管理できます。"
            : endpointResult.error
        }
      />
    );
  }

  const deliveriesResult = await listWebhookDeliveries({
    endpointId: id,
    limit: 100,
    offset: 0,
  });

  return (
    <WebhookDetailView
      endpoint={endpointResult.data}
      deliveries={
        deliveriesResult.success ? deliveriesResult.data.deliveries : []
      }
      deliveriesError={deliveriesResult.success ? null : deliveriesResult.error}
    />
  );
}
