import { WebhookIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { WebhooksListView } from "../_features/webhooks-list";
import { listWebhookEndpoints } from "../_lib/queries";

export async function WebhooksListContainer() {
  const result = await listWebhookEndpoints({ limit: 100, offset: 0 });

  if (!result.success) {
    return (
      <EmptyState
        icon={<WebhookIcon className="size-12" />}
        title="Webhook 設定にアクセスできません"
        description={
          result.error.includes("権限")
            ? "管理者 (owner / admin) のみが Webhook を管理できます。"
            : result.error
        }
      />
    );
  }

  return (
    <WebhooksListView
      endpoints={result.data.endpoints}
      total={result.data.total}
    />
  );
}
