import type { createCommentRepository } from "../../infrastructure/repositories/comment.repository";
import type { createRecordingRepository } from "../../infrastructure/repositories/recording.repository";
import type { createViewEventRepository } from "../../infrastructure/repositories/view-event.repository";
import { type DashboardPeriod, resolveSince } from "./period";

type Deps = {
  recordingRepo: ReturnType<typeof createRecordingRepository>;
  viewEventRepo: ReturnType<typeof createViewEventRepository>;
  commentRepo: ReturnType<typeof createCommentRepository>;
};

export function createDashboardService({
  recordingRepo,
  viewEventRepo,
  commentRepo,
}: Deps) {
  return {
    /**
     * ダッシュボード概要を取得する。
     * 指定期間（period）における録画 / 視聴 / コメントの集計値を返す。
     * すべて組織スコープ（organizationId）で絞り込む。
     */
    async getOverview(params: {
      organizationId: string;
      period: DashboardPeriod;
    }) {
      const since = resolveSince(params.period);

      // 3 クエリは独立なので並列実行する。
      const [recordingAgg, viewAgg, commentAgg] = await Promise.all([
        recordingRepo.aggregateByOrganization({
          organizationId: params.organizationId,
          since,
        }),
        viewEventRepo.aggregateByOrganization({
          organizationId: params.organizationId,
          since,
        }),
        commentRepo.aggregateByOrganization({
          organizationId: params.organizationId,
          since,
        }),
      ]);

      return {
        period: params.period,
        since: since ? since.toISOString() : null,
        recording: {
          count: recordingAgg.count,
          totalDurationMs: recordingAgg.totalDurationMs,
          totalFileSize: recordingAgg.totalFileSize,
          statusBreakdown: recordingAgg.statusBreakdown,
        },
        viewing: {
          totalViews: viewAgg.totalViews,
          uniqueViewers: viewAgg.uniqueViewers,
        },
        commenting: {
          count: commentAgg.count,
        },
      } as const;
    },
  };
}
