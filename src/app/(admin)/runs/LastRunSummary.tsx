"use client";

import { extractFinishedAt, formatUsd, sumRunEstimatedCostUsd } from "./runMetrics";

interface LastRunSummaryProps {
  run: Record<string, unknown> | null;
  steps: Record<string, unknown>[];
}

export default function LastRunSummary({ run, steps }: LastRunSummaryProps) {
  if (!run) {
    return (
      <div className="mx-6 mt-4 rounded-lg border border-[#1a1b22] bg-[#0d0e13] px-5 py-6">
        <p className="font-mono text-xs text-[#3b3d4a]">
          No runs yet. Click <span className="text-blue-400">TEST RUN</span> to verify your pipeline.
        </p>
      </div>
    );
  }

  const status = run.status as string;
  const startedAt = run.started_at as string | null;
  const endedAt = extractFinishedAt(run);
  const runSteps = steps.filter((s) => (s.run_id as string) === (run.id as string));

  // Derive stats
  const articleSteps = runSteps.filter((s) => (s.article_index as number) >= 0);
  const articleIndices = new Set(articleSteps.map((s) => s.article_index as number));
  const totalArticles = articleIndices.size;
  const failedArticles = new Set(
    articleSteps.filter((s) => s.status === "failed").map((s) => s.article_index as number)
  ).size;
  const completedArticles = totalArticles - failedArticles;
  const estimatedCostUsd = sumRunEstimatedCostUsd(runSteps);
  const averageCostPerArticle = totalArticles > 0 ? estimatedCostUsd / totalArticles : 0;

  // Duration
  let durationStr = "—";
  if (startedAt && endedAt) {
    const seconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    durationStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // When it ran
  const whenStr = startedAt
    ? new Date(startedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const statusColor =
    status === "completed"
      ? "text-emerald-400"
      : status === "failed"
      ? "text-red-400"
      : status === "running"
      ? "text-blue-400"
      : "text-[#6b6d7a]";

  const statusLabel =
    status === "completed" ? "Completed" : status === "failed" ? "Failed" : status === "running" ? "Running" : status;

  return (
    <div className="mx-6 mt-4 rounded-lg border border-[#1a1b22] bg-[#0d0e13] px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">Last Run</span>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className={`font-mono text-sm font-bold ${statusColor}`}>{statusLabel}</span>
              <span className="font-mono text-xs text-[#6b6d7a]">{whenStr}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Stat label="Duration" value={durationStr} />
          <Stat label="Articles" value={`${completedArticles}/${totalArticles}`} />
          <Stat label="AI Cost" value={formatUsd(estimatedCostUsd)} />
          {totalArticles > 0 && <Stat label="Per Article" value={formatUsd(averageCostPerArticle)} />}
          {failedArticles > 0 && <Stat label="Errors" value={String(failedArticles)} color="text-red-400" />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">{label}</span>
      <span className={`font-mono text-sm font-bold ${color ?? "text-white"}`}>{value}</span>
    </div>
  );
}
