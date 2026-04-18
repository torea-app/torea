import { FORMAT, jst } from "@torea/shared/date";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return jst(date).format(FORMAT.DATE_SLASH);
}

export function formatDateTime(date: string | Date): string {
  return jst(date).format(FORMAT.DATETIME_SLASH);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}
