import { VideoOffIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RecordingDetailView } from "../_features/recording-detail-view";
import { getComments, getRecording, getRecordingStats } from "../_lib/queries";

type Props = {
  recordingId: string;
};

export async function RecordingDetailContainer({ recordingId }: Props) {
  const result = await getRecording(recordingId);

  if (!result.success) {
    return (
      <EmptyState
        icon={<VideoOffIcon className="size-12" />}
        title="録画が見つかりません"
        description={result.error}
      />
    );
  }

  // 統計とコメントは録画が completed の場合のみ取得
  const [statsResult, commentsResult] =
    result.data.recording.status === "completed"
      ? await Promise.all([
          getRecordingStats(recordingId),
          getComments(recordingId),
        ])
      : [null, null];

  const stats = statsResult?.success === true ? statsResult.data : undefined;
  const comments =
    commentsResult?.success === true ? commentsResult.data.comments : [];

  return (
    <RecordingDetailView
      recording={result.data.recording}
      stats={stats}
      initialComments={comments}
    />
  );
}
