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
    VIDEO_PROCESSING_QUEUE: Queue;
    TRANSCRIPTION_QUEUE: Queue;
    LAMBDA_FUNCTION_URL: string;
    LAMBDA_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    SKIP_VIDEO_PROCESSING: string;
    SKIP_TRANSCRIPTION: string;
  };
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
    activeOrganizationId: string;
  };
};
