import { EmbedOrgMembersView } from "../../_components/embed-org-members-view";
import { EmbedPasswordView } from "../../_components/embed-password-view";
import type { EmbedMetadata } from "../../_lib/types";

type Props = {
  token: string;
  metadata: EmbedMetadata;
};

export function EmbedView({ token, metadata }: Props) {
  if (metadata.type === "org_members") {
    return <EmbedOrgMembersView token={token} metadata={metadata} />;
  }
  return <EmbedPasswordView token={token} metadata={metadata} />;
}
