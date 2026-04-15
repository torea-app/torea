import { VideoIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RecordingsView } from "../_features/recordings-view";
import { getRecordings } from "../_lib/queries";

const LIMIT = 20;

type Props = {
  offset: number;
};

export async function RecordingsContainer({ offset }: Props) {
  const result = await getRecordings({ limit: LIMIT, offset });

  if (!result.success) {
    return (
      <EmptyState
        icon={<VideoIcon className="size-12" />}
        title="データの取得に失敗しました"
        description={result.error}
      />
    );
  }

  const { recordings, total } = result.data;

  if (recordings.length === 0 && offset === 0) {
    return (
      <EmptyState
        icon={<VideoIcon className="size-12" />}
        title="録画がありません"
        description="Chrome 拡張機能から画面を録画すると、ここに表示されます。"
      />
    );
  }

  return (
    <RecordingsView
      recordings={recordings}
      total={total}
      limit={LIMIT}
      offset={offset}
    />
  );
}
