/**
 * 合計録画時間 (ms) を日本語表示にフォーマットする。
 * 例: "3 時間 24 分", "15 分", "45 秒", "0 分"
 */
export function formatTotalDuration(ms: number): string {
  if (ms <= 0) return "0 分";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} 時間 ${minutes} 分` : `${hours} 時間`;
  }
  if (minutes > 0) {
    return `${minutes} 分`;
  }
  return `${seconds} 秒`;
}

/**
 * 合計容量 (bytes) を単位付きで表示する。
 * 例: "1.2 GB", "340 MB", "0 B"
 */
export function formatTotalBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const k = 1024;
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );
  const size = bytes / k ** i;
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** 整数を桁区切りで整形する（例: 1234 → "1,234"）。 */
export function formatCount(n: number): string {
  return n.toLocaleString("ja-JP");
}
