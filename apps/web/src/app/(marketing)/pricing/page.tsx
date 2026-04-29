import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { PricingContainer } from "./_containers/pricing-container";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <Suspense fallback={<LoadingSkeleton />}>
        <PricingContainer />
      </Suspense>
    </div>
  );
}
