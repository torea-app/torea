import { PricingView } from "../_features/pricing-view";
import { getCurrentPlanForPricing } from "../_lib/queries";

export async function PricingContainer() {
  const currentPlan = await getCurrentPlanForPricing();
  return <PricingView currentPlan={currentPlan} />;
}
