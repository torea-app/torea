import { env } from "@torea/env/web";
import { hcWithType } from "@torea/server/hc";
import { headers } from "next/headers";

export async function createServerApi() {
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";
  return hcWithType(env.NEXT_PUBLIC_SERVER_URL, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const reqHeaders = new Headers(init?.headers);
      reqHeaders.set("cookie", cookie);
      return fetch(input, {
        cache: "no-store",
        ...init,
        headers: reqHeaders,
      });
    },
  });
}
