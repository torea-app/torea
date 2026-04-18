"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@torea/ui/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { WebhookDelivery, WebhookEndpoint } from "../../_lib/types";
import { DeliveriesTab } from "./_components/deliveries-tab";
import { OverviewTab } from "./_components/overview-tab";

const TABS = ["overview", "deliveries"] as const;

type Props = {
  endpoint: WebhookEndpoint;
  deliveries: WebhookDelivery[];
  deliveriesError: string | null;
};

export function WebhookDetailView({
  endpoint,
  deliveries,
  deliveriesError,
}: Props) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("overview"),
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
      <TabsList>
        <TabsTrigger value="overview">概要</TabsTrigger>
        <TabsTrigger value="deliveries">
          配信履歴 ({deliveries.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4">
        <OverviewTab endpoint={endpoint} />
      </TabsContent>

      <TabsContent value="deliveries" className="mt-4">
        <DeliveriesTab
          deliveries={deliveries}
          endpointId={endpoint.id}
          errorMessage={deliveriesError}
        />
      </TabsContent>
    </Tabs>
  );
}
