import { logger } from "@/lib/logger";
import { isRetryable, categorizeError } from "@/lib/error-categories";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  /** Per-call timeout in ms. Creates an AbortController that aborts after this duration. */
  timeoutMs?: number;
}

const defaults: Required<Omit<RetryOptions, "timeoutMs">> & { timeoutMs?: number } = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  shouldRetry: isRetryable,
  timeoutMs: undefined,
};

export async function withRetry<T>(
  label: string,
  fn: (signal?: AbortSignal) => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry, timeoutMs } = {
    ...defaults,
    ...opts,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (timeoutMs) {
        controller = new AbortController();
        timer = setTimeout(() => controller!.abort(), timeoutMs);
      }
      const result = await fn(controller?.signal);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err) {
      lastError = err;

      if (timer) clearTimeout(timer);

      const categorized = categorizeError(err);

      if (attempt === maxAttempts || !shouldRetry(err)) {
        logger.warn(`[retry] ${label} failed permanently`, {
          attempt,
          maxAttempts,
          category: categorized.category,
          error: categorized.message,
        });
        break;
      }

      const jitter = Math.random() * 0.3 + 0.85;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) * jitter, maxDelayMs);

      logger.warn(`[retry] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`, {
        category: categorized.category,
        error: categorized.message,
      });

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
