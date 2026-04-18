import { env } from "@torea/env/web";
import { hcWithType } from "@torea/server/hc";

export const api = hcWithType(env.NEXT_PUBLIC_SERVER_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { credentials: "include", cache: "no-store", ...init }),
});
