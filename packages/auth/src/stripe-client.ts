import Stripe from "stripe";

/**
 * Cloudflare Workers と Node.js のいずれでも動く Stripe クライアントを返す。
 *
 * Workers では Node の http モジュールが使えないため fetch ベースに切り替える。
 * Webhook 検証 (constructEventAsync) は Stripe SDK が `crypto.subtle` を自動検出するが、
 * 明示的に SubtleCryptoProvider を export しておき、将来 plugin が cryptoProvider 引数を
 * 必要とした際に差し替えられるようにする。
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export const STRIPE_CRYPTO_PROVIDER = Stripe.createSubtleCryptoProvider();
