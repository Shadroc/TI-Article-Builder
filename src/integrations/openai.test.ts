import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
    },
  };
});

vi.mock("sharp", () => {
  return {
    default: (buffer: Buffer) => ({
      png: () => ({
        toBuffer: async () => buffer,
      }),
    }),
  };
});

vi.mock("@/lib/env", () => ({
  env: () => ({ OPENAI_API_KEY: "test-key" }),
}));

import {
  editImageWithUsage,
  rewriteSeoForSiteWithUsage,
  selectBestImageWithUsage,
} from "@/integrations/openai";

describe("openai cost tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches cost metadata when image selection returns invalid JSON after a billable response", async () => {
    mockCreate.mockResolvedValueOnce({
      model: "gpt-4o-2024-08-06",
      usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      choices: [{ message: { content: "{not-json" } }],
    });

    await expect(
      selectBestImageWithUsage(
        [{ buffer: Buffer.from("image-bytes"), mimeType: "image/png" }],
        "Test title",
        "Markets"
      )
    ).rejects.toMatchObject({
      costs: [
        expect.objectContaining({
          operation: "image_selection",
          estimated_cost_usd: 0.0045,
        }),
      ],
      estimatedCostUsd: 0.0045,
    });
  });

  it("attaches cost metadata when SEO generation fails validation after a billable response", async () => {
    mockCreate.mockResolvedValueOnce({
      model: "gpt-4o-2024-08-06",
      usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      choices: [{ message: { content: JSON.stringify({ keyword: "stocks" }) } }],
    });

    await expect(
      rewriteSeoForSiteWithUsage(
        "Test title",
        "<p>body</p>",
        "Tomorrow Investor",
        "tomorrow-investor",
        "site-1"
      )
    ).rejects.toMatchObject({
      costs: [
        expect.objectContaining({
          operation: "site_seo",
          estimated_cost_usd: 0.0045,
        }),
      ],
      estimatedCostUsd: 0.0045,
    });
  });

  it("attaches cost metadata when image edit returns no output after a billable response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          usage: {
            input_tokens: 1500,
            output_tokens: 200,
            input_tokens_details: { text_tokens: 1000, image_tokens: 500 },
            output_tokens_details: { image_tokens: 200 },
          },
        }),
      })
    );

    await expect(
      editImageWithUsage(Buffer.from("image-bytes"), "Edit prompt", "image/png")
    ).rejects.toMatchObject({
      costs: [
        expect.objectContaining({
          operation: "image_edit",
          estimated_cost_usd: 0.018,
        }),
      ],
      estimatedCostUsd: 0.018,
    });
  });
});
