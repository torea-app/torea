import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@torea/ui/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@torea/ui/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
};

export function MetricCard({ icon, label, value, hint }: Props) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          {icon}
          {label}
        </CardTitle>
        {hint ? (
          <CardAction>
            <Tooltip>
              <TooltipTrigger
                aria-label={`${label}の説明`}
                className="text-muted-foreground hover:text-foreground"
              >
                <InfoIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[220px] text-xs">{hint}</p>
              </TooltipContent>
            </Tooltip>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-2xl tabular-nums" aria-live="polite">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
