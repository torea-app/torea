import { stripe } from "@better-auth/stripe";
import { db } from "@torea/db";
import * as authSchema from "@torea/db/schema/auth";
import * as subscriptionSchema from "@torea/db/schema/subscription";
import { env } from "@torea/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import {
  existingUserSignUpEmailHtml,
  resetPasswordEmailHtml,
  verificationEmailHtml,
} from "./email-templates";
import { ac, admin, member, owner } from "./permissions";
import { createStripeClient } from "./stripe-client";
import { buildStripePlans } from "./stripe-plans";

// @better-auth/stripe plugin が `subscription` モデルを要求するため、
// auth schema と一緒に明示的にマージして drizzleAdapter に渡す。
const schema = { ...authSchema, ...subscriptionSchema };

/**
 * PBKDF2 password hashing using Web Crypto API.
 * crypto.subtle operations do NOT count against CF Workers CPU time limit,
 * making this compatible with the Free plan (10ms CPU).
 */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      key,
      256,
    ),
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));
  return `pbkdf2:100000:${saltB64}:${hashB64}`;
}

async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  const [prefix, iterStr, saltB64, hashB64] = hash.split(":");
  if (prefix === "pbkdf2" && iterStr && saltB64 && hashB64) {
    const iterations = Number(iterStr);
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const storedHash = atob(hashB64);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derived = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        key,
        256,
      ),
    );
    const derivedStr = String.fromCharCode(...derived);
    if (storedHash.length !== derivedStr.length) return false;
    let result = 0;
    for (let i = 0; i < storedHash.length; i++) {
      result |= storedHash.charCodeAt(i) ^ derivedStr.charCodeAt(i);
    }
    return result === 0;
  }
  // Fallback: unsupported hash format
  return false;
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: schema,
  }),
  trustedOrigins: env.CORS_ORIGIN.split(",").map((o: string) => o.trim()),
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const frontendOrigin =
        env.CORS_ORIGIN.split(",")[0]?.trim() ?? env.BETTER_AUTH_URL;
      const verifyUrl = `${frontendOrigin}/verify-email?token=${encodeURIComponent(token)}`;
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.FROM_EMAIL,
        to: [user.email],
        subject: "メールアドレスの確認 - Torea",
        html: verificationEmailHtml(user.name, verifyUrl),
      });
      if (error) {
        console.error("[sendVerificationEmail] Resend API error:", error);
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async onExistingUserSignUp({ user }) {
      console.log(
        "[onExistingUserSignUp] called for user:",
        user.email,
        "id:",
        user.id,
      );
      const frontendOrigin =
        env.CORS_ORIGIN.split(",")[0]?.trim() ?? env.BETTER_AUTH_URL;
      const loginUrl = `${frontendOrigin}/sign-in`;
      console.log("[onExistingUserSignUp] loginUrl:", loginUrl);
      console.log("[onExistingUserSignUp] FROM_EMAIL:", env.FROM_EMAIL);
      console.log(
        "[onExistingUserSignUp] RESEND_API_KEY present:",
        !!env.RESEND_API_KEY,
      );
      const resend = new Resend(env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: env.FROM_EMAIL,
        to: [user.email],
        subject: "アカウント登録について - Torea",
        html: existingUserSignUpEmailHtml(user.name, loginUrl),
      });
      if (error) {
        console.error("[onExistingUserSignUp] Resend API error:", error);
      } else {
        console.log(
          "[onExistingUserSignUp] Email sent successfully, id:",
          data,
        );
      }
    },
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, token }) => {
      const frontendOrigin =
        env.CORS_ORIGIN.split(",")[0]?.trim() ?? env.BETTER_AUTH_URL;
      const resetUrl = `${frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`;
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.FROM_EMAIL,
        to: [user.email],
        subject: "パスワードのリセット - Torea",
        html: resetPasswordEmailHtml(user.name, resetUrl),
      });
      if (error) {
        console.error("[sendResetPassword] Resend API error:", error);
      }
    },
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  plugins: [
    organization({
      ac,
      roles: { owner, admin, member },
      async sendInvitationEmail(data) {
        try {
          const resend = new Resend(env.RESEND_API_KEY);
          // 招待リンクはフロントエンド (Next.js) のページなので、CORS_ORIGIN の
          // 1 番目をフロント origin として使う。BETTER_AUTH_URL は Better Auth
          // ハンドラの URL (Hono server) なのでここでは使わない。
          const frontendOrigin =
            env.CORS_ORIGIN.split(",")[0]?.trim() ?? env.BETTER_AUTH_URL;
          const inviteLink = `${frontendOrigin}/invitation/${data.id}`;
          const { error } = await resend.emails.send({
            from: env.FROM_EMAIL,
            to: [data.email],
            subject: `${data.inviter.user.name} invited you to ${data.organization.name}`,
            html: `
              <p>${data.inviter.user.name} (${data.inviter.user.email}) has invited you to join <strong>${data.organization.name}</strong>.</p>
              <p><a href="${inviteLink}">Accept Invitation</a></p>
            `,
          });
          if (error) {
            console.error("[sendInvitationEmail] Resend API error:", error);
          }
        } catch (e) {
          console.error("[sendInvitationEmail] Failed to send email:", e);
        }
      },
    }),
    stripe({
      stripeClient: createStripeClient(env.STRIPE_SECRET_KEY),
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      // ユーザー単位の課金。組織単位は将来 Team プランで再検討。
      subscription: {
        enabled: true,
        plans: buildStripePlans({
          STRIPE_PRICE_ID_PRO_MONTH: env.STRIPE_PRICE_ID_PRO_MONTH,
          STRIPE_PRICE_ID_PRO_YEAR: env.STRIPE_PRICE_ID_PRO_YEAR,
        }),
        // SaaS の通例として、メール未検証ユーザーが課金開始するのは防ぐ。
        requireEmailVerification: true,
        // 【セキュリティ必須】 subscription.upgrade/cancel/restore/list は
        // クライアントが任意の referenceId を渡せるため、必ず session.user.id と
        // 一致することを検証する。不一致なら false を返して 403 にする。
        // https://better-auth.com/docs/plugins/stripe#authorizing-reference
        authorizeReference: async ({ user, referenceId }) => {
          return referenceId === user.id;
        },
      },
      // 公式 plugin が処理しないイベントを拾う。Phase 3 で usage_quota の月次
      // リセット記録 / 監査ログを実装する。Phase 2 では console.log のみ。
      onEvent: async (event) => {
        console.log("[stripe-webhook] received event:", event.type);
      },
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      ...(env.COOKIE_DOMAIN ? { domain: `.${env.COOKIE_DOMAIN}` } : {}),
    },
  },
});
