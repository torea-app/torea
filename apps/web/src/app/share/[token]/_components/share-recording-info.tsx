import { formatDuration } from "@/lib/format";
import type { ShareMetadata } from "../_lib/types";

type Props = {
  metadata: ShareMetadata;
};

export function ShareRecordingInfo({ metadata }: Props) {
  return (
    <div className="space-y-1">
      <h1 className="font-semibold text-xl">{metadata.recordingTitle}</h1>
      {metadata.durationMs !== null && (
        <p className="text-muted-foreground text-sm">
          {formatDuration(metadata.durationMs)}
        </p>
      )}
    </div>
  );
}
