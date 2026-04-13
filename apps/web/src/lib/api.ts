import { env } from "@screenbase/env/web";
import { hcWithType } from "@screenbase/server/hc";

export const api = hcWithType(env.NEXT_PUBLIC_SERVER_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { credentials: "include", cache: "no-store", ...init }),
});
