import { IntegrationsView } from "../_features/integrations-view";
import {
  getGoogleDriveIntegration,
  getGoogleDrivePreferences,
} from "../_lib/queries";

type Props = {
  status?: string;
  reason?: string;
};

export async function IntegrationsContainer({ status, reason }: Props) {
  const [integrationResult, prefsResult] = await Promise.all([
    getGoogleDriveIntegration(),
    getGoogleDrivePreferences(),
  ]);

  // Drive 連携と preferences は failure を hard error にせず、
  // 「未連携 / autoSave=false」にフォールバックして view を描画する。
  // (画面トップでエラーカードを出すよりも、各カードで誘導した方が UX が自然)
  const integration = integrationResult.success
    ? integrationResult.data
    : { connected: false as const };
  const autoSaveToDrive = prefsResult.success
    ? prefsResult.data.autoSaveToDrive
    : false;

  return (
    <IntegrationsView
      integration={integration}
      autoSaveToDrive={autoSaveToDrive}
      callbackStatus={status}
      callbackReason={reason}
    />
  );
}
