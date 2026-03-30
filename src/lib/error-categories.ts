/** Error categorization — single flat file with categorizeError + isRetryable. */

export type ErrorCategory =
  | "API_TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "MALFORMED_RESPONSE"
  | "UNKNOWN";

export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

const TIMEOUT_PATTERNS = [
  /timed?\s*out/i,
  /abort/i,
  /ETIMEDOUT/,
  /ESOCKETTIMEDOUT/,
  /timeout/i,
  /deadline exceeded/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
  /429/,
  /quota exceeded/i,
  /throttl/i,
];

const NETWORK_PATTERNS = [
  /ECONNREFUSED/,
  /ECONNRESET/,
  /ENOTFOUND/,
  /EPIPE/,
  /socket hang up/i,
  /network/i,
  /fetch failed/i,
  /DNS/i,
];

const MALFORMED_PATTERNS = [
  /invalid JSON/i,
  /unexpected token/i,
  /missing.*field/i,
  /returned no data/i,
  /parse error/i,
];

export function categorizeError(error: unknown): CategorizedError {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  // Check abort signals first
  if (name === "AbortError" || name === "TimeoutError") {
    return { category: "API_TIMEOUT", message, retryable: true };
  }

  // Check status codes on response errors
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 429) {
      return { category: "RATE_LIMIT", message, retryable: true };
    }
    if (status >= 500) {
      return { category: "NETWORK", message, retryable: true };
    }
    if (status === 400 || status === 422) {
      return { category: "MALFORMED_RESPONSE", message, retryable: false };
    }
  }

  for (const pattern of TIMEOUT_PATTERNS) {
    if (pattern.test(message) || pattern.test(name)) {
      return { category: "API_TIMEOUT", message, retryable: true };
    }
  }

  for (const pattern of RATE_LIMIT_PATTERNS) {
    if (pattern.test(message)) {
      return { category: "RATE_LIMIT", message, retryable: true };
    }
  }

  for (const pattern of NETWORK_PATTERNS) {
    if (pattern.test(message)) {
      return { category: "NETWORK", message, retryable: true };
    }
  }

  for (const pattern of MALFORMED_PATTERNS) {
    if (pattern.test(message)) {
      return { category: "MALFORMED_RESPONSE", message, retryable: false };
    }
  }

  return { category: "UNKNOWN", message, retryable: false };
}

export function isRetryable(error: unknown): boolean {
  return categorizeError(error).retryable;
}
