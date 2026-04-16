export function extractEstimatedCostUsd(step: Record<string, unknown>): number {
  const meta = step.step_metadata;
  if (!meta || typeof meta !== "object") return 0;
  const value = (meta as Record<string, unknown>).estimated_cost_usd;
  return typeof value === "number" ? value : 0;
}

export function extractFinishedAt(record: Record<string, unknown>): string | null {
  const finishedAt = record.finished_at;
  if (typeof finishedAt === "string") return finishedAt;

  const endedAt = record.ended_at;
  if (typeof endedAt === "string") return endedAt;

  return null;
}

export function sumRunEstimatedCostUsd(steps: Record<string, unknown>[]): number {
  return Number(
    steps.reduce((total, step) => total + extractEstimatedCostUsd(step), 0).toFixed(6)
  );
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(value >= 1 ? 2 : 3)}`;
}
