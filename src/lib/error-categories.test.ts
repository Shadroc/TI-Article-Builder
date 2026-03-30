import { describe, expect, it } from "vitest";
import { categorizeError, isRetryable } from "./error-categories";

describe("categorizeError", () => {
  it("categorizes timeout errors", () => {
    expect(categorizeError(new Error("Request timed out"))).toMatchObject({
      category: "API_TIMEOUT",
      retryable: true,
    });
    const abort = new DOMException("signal timed out", "TimeoutError");
    expect(categorizeError(abort)).toMatchObject({ category: "API_TIMEOUT", retryable: true });
  });

  it("categorizes rate limit errors", () => {
    expect(categorizeError(new Error("429 Too Many Requests"))).toMatchObject({
      category: "RATE_LIMIT",
      retryable: true,
    });
    expect(categorizeError(new Error("Rate limit exceeded"))).toMatchObject({
      category: "RATE_LIMIT",
      retryable: true,
    });
  });

  it("categorizes network errors", () => {
    expect(categorizeError(new Error("ECONNREFUSED"))).toMatchObject({
      category: "NETWORK",
      retryable: true,
    });
    expect(categorizeError(new Error("fetch failed"))).toMatchObject({
      category: "NETWORK",
      retryable: true,
    });
  });

  it("categorizes 500 errors as network (retryable)", () => {
    expect(categorizeError(new Error("OpenAI image edit failed: 500 Internal Server Error"))).toMatchObject({
      category: "NETWORK",
      retryable: true,
    });
  });

  it("categorizes malformed response errors", () => {
    expect(categorizeError(new Error("OpenAI returned invalid JSON: {bad"))).toMatchObject({
      category: "MALFORMED_RESPONSE",
      retryable: false,
    });
    expect(categorizeError(new Error("missing required fields in response"))).toMatchObject({
      category: "MALFORMED_RESPONSE",
      retryable: false,
    });
  });

  it("defaults to UNKNOWN for unrecognized errors", () => {
    expect(categorizeError(new Error("Something weird happened"))).toMatchObject({
      category: "UNKNOWN",
      retryable: false,
    });
  });
});

describe("isRetryable", () => {
  it("returns true for retryable categories", () => {
    expect(isRetryable(new Error("timed out"))).toBe(true);
    expect(isRetryable(new Error("429"))).toBe(true);
    expect(isRetryable(new Error("ECONNRESET"))).toBe(true);
  });

  it("returns false for non-retryable categories", () => {
    expect(isRetryable(new Error("invalid JSON response"))).toBe(false);
    expect(isRetryable(new Error("some random error"))).toBe(false);
  });
});
