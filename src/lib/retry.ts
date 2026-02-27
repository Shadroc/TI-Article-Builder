export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const defaults: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  shouldRetry: () => true,
};

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, shouldRetry } = {
    ...defaults,
    ...opts,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !shouldRetry(err)) {
        break;
      }

      const jitter = Math.random() * 0.3 + 0.85;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) * jitter, maxDelayMs);

      console.warn(
        `[retry] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
        err instanceof Error ? err.message : err
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
