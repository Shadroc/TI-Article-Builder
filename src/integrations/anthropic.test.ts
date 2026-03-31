import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

vi.mock("@/lib/env", () => ({
  env: () => ({ ANTHROPIC_API_KEY: "test-key" }),
}));

import { rewriteArticleForSite } from "@/integrations/anthropic";

const INPUT_HTML = `<p>According to <a href="https://example.com">sources</a>, the market rose 5%.</p><p>More details <a href="https://other.com">here</a>.</p>`;

describe("rewriteArticleForSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rewritten HTML when valid", async () => {
    const rewritten = `<p>Based on <a href="https://example.com">sources</a>, the market increased 5%.</p><p>Additional details <a href="https://other.com">here</a>.</p>`;

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: rewritten }],
    });

    const result = await rewriteArticleForSite(INPUT_HTML, "TestSite");
    expect(result).toBe(rewritten);
  });

  it("throws when output is not valid HTML", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "This is just plain text with no HTML tags at all." }],
    });

    await expect(rewriteArticleForSite(INPUT_HTML, "TestSite")).rejects.toThrow(
      "Rewrite validation failed: output is not valid HTML"
    );
  });

  it("throws when length ratio exceeds bounds", async () => {
    const tooShort = `<p>Short.</p>`;

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: tooShort }],
    });

    await expect(rewriteArticleForSite(INPUT_HTML, "TestSite")).rejects.toThrow(
      /Rewrite validation failed: length ratio .+ outside 0\.5-1\.5 bounds/
    );
  });

  it("throws when links are missing from rewrite", async () => {
    const missingLink = `<p>Based on <a href="https://example.com">sources</a>, the market increased by 5%.</p><p>Additional information is available for review.</p>`;

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: missingLink }],
    });

    await expect(rewriteArticleForSite(INPUT_HTML, "TestSite")).rejects.toThrow(
      "Rewrite validation failed: missing links: https://other.com"
    );
  });

  it("throws when rewrite adds unexpected links", async () => {
    const addedLink = `<p>Based on <a href="https://example.com">sources</a>, the market increased 5%.</p><p>More details <a href="https://other.com">here</a> and <a href="https://spam.com">click here</a>.</p>`;

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: addedLink }],
    });

    await expect(rewriteArticleForSite(INPUT_HTML, "TestSite")).rejects.toThrow(
      "Rewrite validation failed: unexpected links added: https://spam.com"
    );
  });

  it("throws when Anthropic returns no text block", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [],
    });

    await expect(rewriteArticleForSite(INPUT_HTML, "TestSite")).rejects.toThrow(
      "Anthropic rewrite returned no text"
    );
  });
});
