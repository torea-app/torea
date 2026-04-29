import { EmptyState } from "@/components/empty-state";
import { BillingView } from "../_features/billing-view";
import { getBillingMe } from "../_lib/queries";

type Props = {
  status?: string;
};

export async function BillingContainer({ status }: Props) {
  const result = await getBillingMe();
  if (!result.success) {
    return (
      <EmptyState
        title="課金情報の取得に失敗しました"
        description={result.error}
      />
    );
  }
  return <BillingView data={result.data} status={status ?? null} />;
}
