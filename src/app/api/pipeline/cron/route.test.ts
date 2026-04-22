import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/pipeline/orchestrator", () => ({
  runPipeline: vi.fn(),
}));

vi.mock("@/integrations/supabase", () => ({
  supabase: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runPipeline } from "@/pipeline/orchestrator";
import { supabase } from "@/integrations/supabase";
import { env, Env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { GET, getCronArticleCount } from "./route";

describe("cron route", () => {
  const runPipelineMock = vi.mocked(runPipeline);
  const supabaseMock = vi.mocked(supabase);
  const envMock = vi.mocked(env);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    envMock.mockReturnValue({
      CRON_SECRET: "cron-secret",
      CRON_MAX_ARTICLES: 5,
    } as Env);
  });

  it("returns 401 and logs safe diagnostics when cron auth fails", async () => {
    const response = await GET(
      new Request("http://localhost/api/pipeline/cron", {
        headers: { "user-agent": "vercel-cron/1.0" },
      }) as never
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(logger.warn).toHaveBeenCalledWith(
      "Cron request unauthorized",
      expect.objectContaining({
        hasAuthorizationHeader: false,
        authorizationLooksBearer: false,
      })
    );
  });

  it("clamps cron article count before running the pipeline", async () => {
    supabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { headlines_to_fetch: 6, headlines_date: "today" },
              error: null,
            }),
          })),
        })),
      })),
    } as never);
    runPipelineMock.mockResolvedValue({
      runId: "run-123",
      articlesProcessed: 5,
      errors: [],
    });

    const response = await GET(
      new Request("http://localhost/api/pipeline/cron", {
        headers: { authorization: "Bearer cron-secret" },
      }) as never
    );

    expect(runPipelineMock).toHaveBeenCalledWith({
      trigger: "cron",
      articleCount: 5,
      headlinesDate: "today",
    });
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-123",
      configuredArticleCount: 6,
      effectiveArticleCount: 5,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Cron article count clamped to avoid maxDuration timeout",
      expect.objectContaining({
        configuredArticleCount: 6,
        effectiveArticleCount: 5,
      })
    );
  });

  it("uses the default cap when CRON_MAX_ARTICLES is unset", () => {
    envMock.mockReturnValue({
      CRON_SECRET: "cron-secret",
    } as Env);

    expect(getCronArticleCount(6)).toBe(5);
    expect(getCronArticleCount(1)).toBe(1);
  });

});
