import { ac, admin, member, owner } from "@torea/auth/permissions";
import { stripeClient } from "@torea/auth/stripe-client-plugin";
import { env } from "@torea/env/web";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    organizationClient({
      ac,
      roles: { owner, admin, member },
    }),
    stripeClient({ subscription: true }),
  ],
});
