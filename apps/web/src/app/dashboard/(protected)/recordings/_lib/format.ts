/**
 * ミリ秒を "MM:SS" または "HH:MM:SS" 形式にフォーマットする。
 * null の場合は "—" を返す。
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * バイト数を人間が読みやすい形式にフォーマットする。
 * null の場合は "—" を返す。
 */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / k ** i;

  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * ISO 文字列を相対時間表示にフォーマットする。
 * 例: "たった今", "3分前", "1時間前", "2日前", "2024/04/14"
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
