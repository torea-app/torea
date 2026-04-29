import type { auth } from "@torea/auth";
import type { CurrentPlan } from "./domain/types/billing";

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
    WEBHOOK_DELIVERY_QUEUE: Queue<{
      deliveryId: string;
      organizationId: string;
    }>;
    DRIVE_EXPORT_QUEUE: Queue<{
      exportId: string;
      recordingId: string;
      organizationId: string;
    }>;
    VIDEO_PROCESSING_QUEUE_NAME: string;
    TRANSCRIPTION_QUEUE_NAME: string;
    WEBHOOK_DELIVERY_QUEUE_NAME: string;
    DRIVE_EXPORT_QUEUE_NAME: string;
    WEBHOOK_SECRET_KV: KVNamespace;
    LAMBDA_FUNCTION_URL: string;
    LAMBDA_REGION: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    SKIP_VIDEO_PROCESSING: string;
    SKIP_TRANSCRIPTION: string;
    GOOGLE_OAUTH_CLIENT_ID: string;
    GOOGLE_OAUTH_CLIENT_SECRET: string;
    GOOGLE_OAUTH_REDIRECT_URI: string;
    INTEGRATION_ENCRYPTION_KEY: string;
    SKIP_DRIVE_EXPORT: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRICE_ID_PRO_MONTH: string;
    STRIPE_PRICE_ID_PRO_YEAR: string;
    STRIPE_PORTAL_RETURN_URL: string;
    STRIPE_CHECKOUT_SUCCESS_URL: string;
    STRIPE_CHECKOUT_CANCEL_URL: string;
  };
  Variables: {
    user: typeof auth.$Infer.Session.user;
    session: typeof auth.$Infer.Session.session;
    activeOrganizationId: string;
    /** Phase 3 追加。requirePlan / 録画ルートが set。 */
    currentPlan?: CurrentPlan;
  };
};
