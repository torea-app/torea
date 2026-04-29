import type { BillingMe } from "../../_lib/types";
import { CancellationBanner } from "./_components/cancellation-banner";
import { CheckoutStatusToast } from "./_components/checkout-status-toast";
import { CurrentPlanCard } from "./_components/current-plan-card";
import { CustomerPortalLink } from "./_components/customer-portal-link";
import { UsageProgress } from "./_components/usage-progress";

type Props = {
  data: BillingMe;
  status: string | null;
};

export function BillingView({ data, status }: Props) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <CheckoutStatusToast status={status} />
      {data.cancelAtPeriodEnd ? (
        <CancellationBanner periodEnd={data.periodEnd} />
      ) : null}
      <CurrentPlanCard data={data} />
      <UsageProgress data={data} />
      <div>
        <CustomerPortalLink plan={data.plan} />
      </div>
    </div>
  );
}
