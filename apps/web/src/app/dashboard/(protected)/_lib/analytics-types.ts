/**
 * Dashboard の型は server の Hono RPC 戻り値から InferResponseType で導出する。
 * 手動 type 定義は禁止。server の変更が web に自動反映される。
 * Date は wire 上 JSON 文字列 (JSONParsed) として推論される。
 */
import type { Client, InferResponseType } from "@torea/server/hc";

type DashboardApi = Client["api"]["dashboard"];

export type DashboardOverviewResponse = InferResponseType<
  DashboardApi["overview"]["$get"]
>;

export type DashboardRecordingAgg = DashboardOverviewResponse["recording"];
export type DashboardViewingAgg = DashboardOverviewResponse["viewing"];
export type DashboardCommentingAgg = DashboardOverviewResponse["commenting"];
export type DashboardStatusBreakdown = DashboardRecordingAgg["statusBreakdown"];
