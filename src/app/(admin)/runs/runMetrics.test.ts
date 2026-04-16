import { describe, expect, it } from "vitest";
import { extractFinishedAt } from "./runMetrics";

describe("extractFinishedAt", () => {
  it("prefers finished_at when present", () => {
    expect(
      extractFinishedAt({
        finished_at: "2026-04-15T12:00:00.000Z",
        ended_at: "2026-04-15T11:00:00.000Z",
      })
    ).toBe("2026-04-15T12:00:00.000Z");
  });

  it("falls back to ended_at for backward compatibility", () => {
    expect(
      extractFinishedAt({
        ended_at: "2026-04-15T11:00:00.000Z",
      })
    ).toBe("2026-04-15T11:00:00.000Z");
  });
});
