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

import { runPipeline } from "@/pipeline/orchestrator";
import { supabase } from "@/integrations/supabase";
import { env, Env } from "@/lib/env";
import { POST } from "./route";

describe("pipeline retry route", () => {
  const runPipelineMock = vi.mocked(runPipeline);
  const supabaseMock = vi.mocked(supabase);
  const envMock = vi.mocked(env);

  beforeEach(() => {
    vi.clearAllMocks();
    envMock.mockReturnValue({
      PIPELINE_SECRET: "pipeline-secret",
    } as Env);
  });

  it("uses five articles when pipeline config has no count", async () => {
    supabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { headlines_to_fetch: null, headlines_date: "today" },
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

    const response = await POST(
      new Request("http://localhost/api/pipeline/retry", {
        method: "POST",
        headers: { authorization: "Bearer pipeline-secret" },
      }) as never
    );

    expect(runPipelineMock).toHaveBeenCalledWith({
      trigger: "manual",
      articleCount: 5,
      headlinesDate: "today",
    });
    await expect(response.json()).resolves.toMatchObject({
      runId: "run-123",
      articlesProcessed: 5,
    });
  });
});
