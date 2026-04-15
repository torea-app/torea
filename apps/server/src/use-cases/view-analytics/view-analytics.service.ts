import { ValidationError } from "../../domain/errors/domain.error";
import type { ViewStats } from "../../domain/types/view-analytics";
import type { createViewEventRepository } from "../../infrastructure/repositories/view-event.repository";

/** 重複排除の時間窓（1 時間） */
const DEDUP_WINDOW_MS = 60 * 60 * 1000;

type Deps = {
  repo: ReturnType<typeof createViewEventRepository>;
  generateId: () => string;
};

export function createViewAnalyticsService({ repo, generateId }: Deps) {
  return {
    /**
     * 視聴イベントを記録し、最新の統計を返す。
     *
     * 重複排除: 同一ビューアー × 同一録画で直近 1 時間以内のイベントがある場合、
     * 新規イベントは挿入せずに現在の統計のみを返す。
     *
     * @param viewerUserId ログインユーザーの場合に指定（null の場合は匿名）
     * @param visitorId 匿名ユーザーの Cookie 値（null の場合はログインユーザー）
     * @throws ValidationError ビューアー識別子が両方 null の場合
     */
    async recordView(params: {
      recordingId: string;
      shareLinkId: string;
      viewerUserId: string | null;
      visitorId: string | null;
    }): Promise<ViewStats> {
      if (!params.viewerUserId && !params.visitorId) {
        throw new ValidationError(
          "Either viewerUserId or visitorId is required",
        );
      }

      // 重複チェック
      const since = new Date(Date.now() - DEDUP_WINDOW_MS);
      const isDuplicate = await repo.existsRecentByViewer({
        recordingId: params.recordingId,
        viewerUserId: params.viewerUserId,
        visitorId: params.visitorId,
        since,
      });

      if (!isDuplicate) {
        await repo.create({
          id: generateId(),
          recordingId: params.recordingId,
          shareLinkId: params.shareLinkId,
          viewerUserId: params.viewerUserId,
          visitorId: params.visitorId,
        });
      }

      return repo.getStats(params.recordingId);
    },

    /**
     * 録画の視聴統計を取得する。
     * ダッシュボードの録画詳細ページで使用。
     */
    async getStats(recordingId: string): Promise<ViewStats> {
      return repo.getStats(recordingId);
    },
  };
}
