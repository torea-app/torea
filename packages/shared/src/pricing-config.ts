/** プラン識別子。DB（subscription.plan）にもこの文字列で保存される。 */
export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** 課金間隔。 */
export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** 録画品質プリセット名。`apps/extension` 既存と整合。 */
export const QUALITY_PRESETS = ["low", "medium", "high", "ultra"] as const;
export type QualityPreset = (typeof QUALITY_PRESETS)[number];

/** プランごとの限界値・許可機能。UI 表示・API ガードの両方から参照される。 */
export type PlanLimits = {
  /** 1 本あたりの最大録画時間（ミリ秒）。Free=30 分、Pro=3 時間。 */
  maxRecordingDurationMs: number;
  /** 月の総録画時間（ミリ秒）。Pro=無制限（センチネル -1）。 */
  monthlyRecordingDurationMs: number;
  /** 録画保持日数。Pro は `null` で「無期限」。 */
  retentionDays: number | null;
  /** 利用可能な解像度プリセット。 */
  availableQualities: ReadonlyArray<QualityPreset>;
  /** Drive 自動保存を許可するか。 */
  driveAutoSaveAllowed: boolean;
  /** ストレージ上限（GB）。Free は `null`（保持期間で制御）。 */
  storageGb: number | null;
};

export const PLAN_LIMITS: Readonly<Record<PlanId, PlanLimits>> = {
  free: {
    maxRecordingDurationMs: 30 * 60 * 1000,
    monthlyRecordingDurationMs: 120 * 60 * 1000,
    retentionDays: 14,
    availableQualities: ["low", "medium", "high"],
    driveAutoSaveAllowed: false,
    storageGb: null,
  },
  pro: {
    maxRecordingDurationMs: 3 * 60 * 60 * 1000,
    monthlyRecordingDurationMs: -1,
    retentionDays: null,
    availableQualities: ["low", "medium", "high", "ultra"],
    driveAutoSaveAllowed: true,
    storageGb: 100,
  },
} as const;

/** 表示用の料金（JPY）。実際の Stripe Price ID は env 経由で注入される。 */
export const PLAN_PRICES_JPY: Readonly<
  Record<Exclude<PlanId, "free">, Record<BillingInterval, number>>
> = {
  pro: { month: 1500, year: 12000 },
} as const;

/** プランが「Free 以上」「Pro 以上」を満たすかを判定するヘルパ。 */
export function planMeets(current: PlanId, required: PlanId): boolean {
  const order: Record<PlanId, number> = { free: 0, pro: 1 };
  return order[current] >= order[required];
}

/**
 * 月のローリングウィンドウの開始時刻（毎月 1 日 00:00 JST）の UTC 表現。
 * usage_quota.periodStart の単一の真実源。サーバー / cron / web で同じ実装を使う。
 */
export function getCurrentPeriodStart(now: Date = new Date()): Date {
  // JST = UTC+9。JST の年・月を計算した上で UTC に戻す（月初 00:00 JST = UTC 前月 15:00）。
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const periodStartUtc = Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    1,
    -9,
  );
  return new Date(periodStartUtc);
}
