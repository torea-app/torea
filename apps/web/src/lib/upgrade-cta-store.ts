"use client";

import { useSyncExternalStore } from "react";

/**
 * `<UpgradeCtaDialog />` を開く理由。
 * dialog のコピー（タイトル / 本文）切り替えと、`/pricing?source=` クエリでの
 * コンバージョン分析タグ付けに使う。
 */
export type UpgradeCtaSource =
  | "quota_exceeded"
  | "single_recording_too_long"
  | "quality_locked_ultra"
  | "drive_auto_save"
  | "view_analytics_locked";

type State = {
  open: boolean;
  source: UpgradeCtaSource | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();
let state: State = { open: false, source: null };

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: State): void {
  state = next;
  emit();
}

/**
 * モジュールレベル API。React Component 外（API ヘルパなど）から呼べる。
 */
export function openUpgradeCtaDialog(args: { source: UpgradeCtaSource }): void {
  setState({ open: true, source: args.source });
}

export function closeUpgradeCtaDialog(): void {
  setState({ open: false, source: null });
}

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): State => state;
// SSR / RSC でも安全に読めるようにサーバスナップショットを用意（常に閉じている）。
const SERVER_STATE: State = { open: false, source: null };
const getServerSnapshot = (): State => SERVER_STATE;

/**
 * Client Component で `<UpgradeCtaDialog />` 自身が状態を購読するためのフック。
 * 外部からは {@link openUpgradeCtaDialog} / {@link closeUpgradeCtaDialog} を使う。
 */
export function useUpgradeCta(): State & {
  close: () => void;
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    open: snapshot.open,
    source: snapshot.source,
    close: closeUpgradeCtaDialog,
  };
}
