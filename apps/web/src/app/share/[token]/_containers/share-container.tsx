import { notFound } from "next/navigation";
import { ShareView } from "../_features/share-view";
import { getShareMetadata } from "../_lib/queries";

type Props = {
  token: string;
};

export async function ShareContainer({ token }: Props) {
  const result = await getShareMetadata(token);

  if (!result.success) {
    notFound();
  }

  return <ShareView token={token} metadata={result.data} />;
}
