import type { auth } from "@screenbase/auth";

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    R2: R2Bucket;
    CORS_ORIGIN: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    RESEND_API_KEY: string;
    FROM_EMAIL: string;
    KV: KVNamespace;
    COOKIE_DOMAIN: string;
  };
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
    activeOrganizationId: string;
  };
};
