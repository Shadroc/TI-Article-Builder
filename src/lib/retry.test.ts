import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const result = await withRetry("test", () => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("retries on retryable error then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      "test",
      () => {
        calls++;
        if (calls < 2) throw new Error("ECONNRESET");
        return Promise.resolve("recovered");
      },
      { maxAttempts: 3, baseDelayMs: 1 }
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(2);
  });

  it("throws after max attempts exhausted", async () => {
    await expect(
      withRetry("test", () => Promise.reject(new Error("ECONNREFUSED")), {
        maxAttempts: 2,
        baseDelayMs: 1,
      })
    ).rejects.toThrow("ECONNREFUSED");
  });

  it("throws immediately on non-retryable error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        "test",
        () => {
          calls++;
          return Promise.reject(new Error("Something weird"));
        },
        { maxAttempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toThrow("Something weird");
    expect(calls).toBe(1);
  });

  it("aborts via timeoutMs when fn takes too long", async () => {
    await expect(
      withRetry(
        "test",
        (signal) =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError"))
            );
          }),
        { maxAttempts: 1, timeoutMs: 50 }
      )
    ).rejects.toThrow();
  });
});
