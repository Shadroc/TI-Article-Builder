export interface CostEstimate {
  provider: "anthropic" | "openai";
  model: string;
  operation: string;
  estimated_cost_usd: number;
  input_cost_usd: number;
  output_cost_usd: number;
  input_tokens?: number;
  output_tokens?: number;
  input_text_tokens?: number;
  input_image_tokens?: number;
  output_image_tokens?: number;
}

export interface AnthropicUsageSnapshot {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface OpenAIChatUsageSnapshot {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

export interface OpenAIImageUsageSnapshot {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: {
    text_tokens: number;
    image_tokens: number;
  };
  output_tokens_details?: {
    image_tokens: number;
  };
}

type TokenPricing = {
  input_per_million_usd: number;
  output_per_million_usd: number;
};

type ImageTokenPricing = {
  text_input_per_million_usd: number;
  image_input_per_million_usd: number;
  image_output_per_million_usd: number;
};

const ANTHROPIC_TEXT_PRICING: Record<string, TokenPricing> = {
  "claude-sonnet-4-20250514": {
    input_per_million_usd: 3,
    output_per_million_usd: 15,
  },
};

const OPENAI_CHAT_PRICING: Record<string, TokenPricing> = {
  "gpt-4o": {
    input_per_million_usd: 2.5,
    output_per_million_usd: 10,
  },
};

const OPENAI_IMAGE_PRICING: Record<string, ImageTokenPricing> = {
  "gpt-image-1": {
    text_input_per_million_usd: 5,
    image_input_per_million_usd: 10,
    image_output_per_million_usd: 40,
  },
};

function resolvePricing<ModelPricing>(
  model: string,
  pricingTable: Record<string, ModelPricing>
): ModelPricing | null {
  if (pricingTable[model]) return pricingTable[model];

  const canonicalModel = Object.keys(pricingTable).find(
    (knownModel) => model === knownModel || model.startsWith(`${knownModel}-`)
  );

  return canonicalModel ? pricingTable[canonicalModel] : null;
}

function usdFromTokens(tokens: number, perMillionUsd: number): number {
  return (tokens / 1_000_000) * perMillionUsd;
}

function roundUsd(value: number): number {
  return Number(value.toFixed(6));
}

export function sumEstimatedCostUsd(costs: Array<CostEstimate | null | undefined>): number {
  return roundUsd(
    costs.reduce((total, cost) => total + (cost?.estimated_cost_usd ?? 0), 0)
  );
}

export function estimateAnthropicTextCost(
  model: string,
  usage: AnthropicUsageSnapshot,
  operation: string
): CostEstimate | null {
  const pricing = resolvePricing(model, ANTHROPIC_TEXT_PRICING);
  if (!pricing) return null;

  const inputCost = usdFromTokens(usage.input_tokens, pricing.input_per_million_usd);
  const outputCost = usdFromTokens(usage.output_tokens, pricing.output_per_million_usd);

  return {
    provider: "anthropic",
    model,
    operation,
    estimated_cost_usd: roundUsd(inputCost + outputCost),
    input_cost_usd: roundUsd(inputCost),
    output_cost_usd: roundUsd(outputCost),
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  };
}

export function estimateOpenAIChatCost(
  model: string,
  usage: OpenAIChatUsageSnapshot,
  operation: string
): CostEstimate | null {
  const pricing = resolvePricing(model, OPENAI_CHAT_PRICING);
  if (!pricing) return null;

  const inputCost = usdFromTokens(usage.prompt_tokens, pricing.input_per_million_usd);
  const outputCost = usdFromTokens(usage.completion_tokens, pricing.output_per_million_usd);

  return {
    provider: "openai",
    model,
    operation,
    estimated_cost_usd: roundUsd(inputCost + outputCost),
    input_cost_usd: roundUsd(inputCost),
    output_cost_usd: roundUsd(outputCost),
    input_tokens: usage.prompt_tokens,
    output_tokens: usage.completion_tokens,
  };
}

export function estimateOpenAIImageCost(
  model: string,
  usage: OpenAIImageUsageSnapshot,
  operation: string
): CostEstimate | null {
  const pricing = resolvePricing(model, OPENAI_IMAGE_PRICING);
  if (!pricing) return null;

  const inputTextTokens = usage.input_tokens_details?.text_tokens ?? 0;
  const inputImageTokens = usage.input_tokens_details?.image_tokens ?? 0;
  const outputImageTokens = usage.output_tokens_details?.image_tokens ?? usage.output_tokens;

  const inputCost =
    usdFromTokens(inputTextTokens, pricing.text_input_per_million_usd) +
    usdFromTokens(inputImageTokens, pricing.image_input_per_million_usd);
  const outputCost = usdFromTokens(outputImageTokens, pricing.image_output_per_million_usd);

  return {
    provider: "openai",
    model,
    operation,
    estimated_cost_usd: roundUsd(inputCost + outputCost),
    input_cost_usd: roundUsd(inputCost),
    output_cost_usd: roundUsd(outputCost),
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    input_text_tokens: inputTextTokens,
    input_image_tokens: inputImageTokens,
    output_image_tokens: outputImageTokens,
  };
}
