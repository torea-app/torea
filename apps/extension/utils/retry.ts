import { RETRY } from "../lib/constants";

type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
};

/**
 * 指数バックオフ付きリトライ
 * API 呼び出しの一時的な失敗に対して自動リトライを行う。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? RETRY.MAX_ATTEMPTS;
  const initialDelayMs = options?.initialDelayMs ?? RETRY.INITIAL_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? RETRY.MAX_DELAY_MS;
  const backoffMultiplier =
    options?.backoffMultiplier ?? RETRY.BACKOFF_MULTIPLIER;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}
