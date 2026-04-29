"use client";

import { Badge } from "@torea/ui/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@torea/ui/components/ui/tabs";
import type { BillingInterval } from "@/lib/pricing";

type Props = {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
};

export function BillingIntervalToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center justify-center">
      <Tabs
        value={value}
        onValueChange={(next) => {
          if (next === "month" || next === "year") onChange(next);
        }}
      >
        <TabsList aria-label="課金間隔">
          <TabsTrigger value="month">月額</TabsTrigger>
          <TabsTrigger value="year">
            年額
            <Badge variant="secondary" className="ml-2">
              33% OFF
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
