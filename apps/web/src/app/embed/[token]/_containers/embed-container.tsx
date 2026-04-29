import { notFound } from "next/navigation";
import { EmbedView } from "../_features/embed-view";
import { getEmbedMetadata } from "../_lib/queries";

type Props = {
  token: string;
};

export async function EmbedContainer({ token }: Props) {
  const result = await getEmbedMetadata(token);

  if (!result.success) {
    notFound();
  }

  return <EmbedView token={token} metadata={result.data} />;
}
