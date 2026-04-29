import type { GoogleDriveIntegrationStatus } from "../../_lib/types";
import { GoogleDriveIntegrationCard } from "./_features/google-drive-integration-card";

type Props = {
  integration: GoogleDriveIntegrationStatus;
  autoSaveToDrive: boolean;
  callbackStatus?: string;
  callbackReason?: string;
};

export function IntegrationsView({
  integration,
  autoSaveToDrive,
  callbackStatus,
  callbackReason,
}: Props) {
  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-semibold text-lg">連携</h2>
      <p className="text-muted-foreground text-sm">
        外部サービスと連携して、録画と文字起こしの保存先を拡張します。
      </p>
      <GoogleDriveIntegrationCard
        initialIntegration={integration}
        initialAutoSave={autoSaveToDrive}
        callbackStatus={callbackStatus}
        callbackReason={callbackReason}
      />
    </div>
  );
}
