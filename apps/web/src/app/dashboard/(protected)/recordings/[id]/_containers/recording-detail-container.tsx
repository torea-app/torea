import { VideoOffIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { RecordingDetailView } from "../_features/recording-detail-view";
import {
  getComments,
  getDriveExportContext,
  getRecording,
  getRecordingStats,
} from "../_lib/queries";

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

  const isCompleted = result.data.recording.status === "completed";

  // 統計・コメント・Drive 状態は録画が completed の場合のみ取得
  const [statsResult, commentsResult, driveContextResult] = isCompleted
    ? await Promise.all([
        getRecordingStats(recordingId),
        getComments(recordingId),
        getDriveExportContext(recordingId),
      ])
    : [null, null, null];

  const stats = statsResult?.success === true ? statsResult.data : undefined;
  const comments =
    commentsResult?.success === true ? commentsResult.data.comments : [];
  const driveContext =
    driveContextResult?.success === true ? driveContextResult.data : null;
  const driveExports = driveContext?.exports ?? [];
  const driveStatus = driveContext?.driveStatus;
  const driveConnected =
    driveStatus?.connected === true &&
    "status" in driveStatus &&
    driveStatus.status === "active";

  return (
    <RecordingDetailView
      recording={result.data.recording}
      stats={stats}
      initialComments={comments}
      driveExports={driveExports}
      driveConnected={driveConnected}
    />
  );
}
