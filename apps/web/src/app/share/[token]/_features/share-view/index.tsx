import { OrgMembersView } from "../../_components/org-members-view";
import { PasswordProtectedView } from "../../_components/password-protected-view";
import type { ShareMetadata } from "../../_lib/types";

type Props = {
  token: string;
  metadata: ShareMetadata;
};

export function ShareView({ token, metadata }: Props) {
  if (metadata.type === "org_members") {
    return <OrgMembersView token={token} metadata={metadata} />;
  }
  return <PasswordProtectedView token={token} metadata={metadata} />;
}
