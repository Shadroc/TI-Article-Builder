import { describe, expect, it } from "vitest";
import {
  estimateAnthropicTextCost,
  estimateOpenAIChatCost,
  estimateOpenAIImageCost,
  sumEstimatedCostUsd,
} from "./costs";

describe("cost estimators", () => {
  it("estimates Anthropic Sonnet text cost", () => {
    const cost = estimateAnthropicTextCost(
      "claude-sonnet-4-20250514",
      { input_tokens: 100_000, output_tokens: 2_000 },
      "article_generation"
    );

    expect(cost?.estimated_cost_usd).toBe(0.33);
    expect(cost?.input_cost_usd).toBe(0.3);
    expect(cost?.output_cost_usd).toBe(0.03);
  });

  it("estimates OpenAI gpt-4o chat cost", () => {
    const cost = estimateOpenAIChatCost(
      "gpt-4o",
      { prompt_tokens: 8_000, completion_tokens: 400 },
      "site_seo"
    );

    expect(cost?.estimated_cost_usd).toBe(0.024);
    expect(cost?.input_cost_usd).toBe(0.02);
    expect(cost?.output_cost_usd).toBe(0.004);
  });

  it("estimates OpenAI snapshot chat cost using canonical pricing", () => {
    const cost = estimateOpenAIChatCost(
      "gpt-4o-2024-08-06",
      { prompt_tokens: 8_000, completion_tokens: 400 },
      "site_seo"
    );

    expect(cost?.estimated_cost_usd).toBe(0.024);
    expect(cost?.model).toBe("gpt-4o-2024-08-06");
  });

  it("estimates OpenAI gpt-image-1 image-edit cost from usage tokens", () => {
    const cost = estimateOpenAIImageCost(
      "gpt-image-1",
      {
        input_tokens: 400,
        output_tokens: 6000,
        input_tokens_details: { text_tokens: 150, image_tokens: 250 },
        output_tokens_details: { image_tokens: 6000 },
      },
      "image_edit"
    );

    expect(cost?.estimated_cost_usd).toBe(0.24325);
    expect(cost?.input_cost_usd).toBe(0.00325);
    expect(cost?.output_cost_usd).toBe(0.24);
  });

  it("sums estimated costs safely", () => {
    const total = sumEstimatedCostUsd([
      { estimated_cost_usd: 0.12 } as never,
      null,
      { estimated_cost_usd: 0.055 } as never,
    ]);

    expect(total).toBe(0.175);
  });
});
