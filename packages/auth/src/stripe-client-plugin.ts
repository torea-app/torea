/**
 * @better-auth/stripe の **クライアント側プラグイン** の re-export。
 *
 * 既存の `stripe-client.ts` はサーバ用 Stripe SDK を生成する側なので、
 * クライアント用は別ファイルに分離している。
 *
 * web app からは `@torea/auth/stripe-client-plugin` でこれを取り込み、
 * `createAuthClient({ plugins: [stripeClient({ subscription: true })] })` で
 * `authClient.subscription.upgrade()` / `authClient.subscription.billingPortal()`
 * 等のメソッドを生やす。
 */
export { stripeClient } from "@better-auth/stripe/client";
