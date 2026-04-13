import app from "./app";
import type { AppEnv } from "./types";

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    _env: AppEnv["Bindings"],
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Reserved for future scheduled jobs
  },
};

export type { AppType } from "./app";
