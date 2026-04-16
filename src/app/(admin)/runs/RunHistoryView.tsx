"use client";

import { useState } from "react";
import { extractFinishedAt, formatUsd, sumRunEstimatedCostUsd } from "./runMetrics";

interface RunHistoryViewProps {
  runs: Record<string, unknown>[];
  allSteps: Record<string, unknown>[];
}

export default function RunHistoryView({ runs, allSteps }: RunHistoryViewProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 font-mono text-xs text-[#3b3d4a]">
        <p>No pipeline history yet.</p>
        <p className="mt-1 text-[10px]">Run the pipeline to start tracking performance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DurationTrend runs={runs} />
        <CostTrend runs={runs} allSteps={allSteps} />
      </div>

      {/* Run list */}
      <div>
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">Run History</h3>
        <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] divide-y divide-[#1a1b22]">
          {runs.map((run) => {
            const runId = run.id as string;
            const status = run.status as string;
            const startedAt = run.started_at as string | null;
            const endedAt = extractFinishedAt(run);
            const isExpanded = expandedRunId === runId;

            const runSteps = allSteps.filter((s) => (s.run_id as string) === runId);
            const articleCount = new Set(
              runSteps.filter((s) => (s.article_index as number) >= 0).map((s) => s.article_index)
            ).size;
            const errorCount = new Set(
              runSteps.filter((s) => s.status === "failed").map((s) => s.article_index)
            ).size;
            const estimatedCostUsd = sumRunEstimatedCostUsd(runSteps);
            const averageCostPerArticle = articleCount > 0 ? estimatedCostUsd / articleCount : 0;

            let durationStr = "—";
            let durationSeconds = 0;
            if (startedAt && endedAt) {
              durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
              const m = Math.floor(durationSeconds / 60);
              const s = durationSeconds % 60;
              durationStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
            }

            const whenStr = startedAt
              ? new Date(startedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—";

            const statusIcon =
              status === "completed" ? "●" : status === "failed" ? "✗" : status === "running" ? "◉" : "○";
            const statusColor =
              status === "completed"
                ? "text-emerald-400"
                : status === "failed"
                ? "text-red-400"
                : status === "running"
                ? "text-blue-400"
                : "text-[#3b3d4a]";

            return (
              <div key={runId}>
                <button
                  onClick={() => setExpandedRunId(isExpanded ? null : runId)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-[#111218] sm:gap-4"
                >
                  <span className={`font-mono text-xs ${statusColor}`}>{statusIcon}</span>
                  <span className="font-mono text-xs text-[#8b8d9a]">{whenStr}</span>
                  <span className="font-mono text-xs text-white">{durationStr}</span>
                  <span className="font-mono text-[10px] text-[#6b6d7a]">
                    {articleCount} article{articleCount !== 1 ? "s" : ""}
                  </span>
                  <span className="font-mono text-[10px] text-blue-300">
                    {formatUsd(estimatedCostUsd)}
                  </span>
                  {articleCount > 0 && (
                    <span className="font-mono text-[10px] text-[#6b6d7a]">
                      {formatUsd(averageCostPerArticle)}/article
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="font-mono text-[10px] text-red-400">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-[#3b3d4a]">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </button>

                {isExpanded && (
                  <RunStepBreakdown steps={runSteps} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Mini bar chart showing duration trend for last 20 runs */
function DurationTrend({ runs }: { runs: Record<string, unknown>[] }) {
  const data = runs
    .slice(0, 20)
    .reverse()
    .map((run) => {
      const started = run.started_at as string | null;
      const ended = extractFinishedAt(run);
      const status = run.status as string;
      let seconds = 0;
      if (started && ended) {
        seconds = Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000);
      }
      return { seconds, status };
    });

  if (data.length < 2) return null;

  const maxSeconds = Math.max(...data.map((d) => d.seconds), 1);

  return (
    <div>
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">Duration Trend</h3>
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] px-4 py-3">
        <div className="flex items-end gap-1" style={{ height: 64 }}>
          {data.map((d, i) => {
            const height = maxSeconds > 0 ? Math.max(2, (d.seconds / maxSeconds) * 56) : 2;
            const color =
              d.status === "completed"
                ? "bg-emerald-500/70"
                : d.status === "failed"
                ? "bg-red-500/70"
                : "bg-blue-500/70";

            return (
              <div
                key={i}
                className={`flex-1 rounded-t ${color} transition-all`}
                style={{ height }}
                title={`${Math.floor(d.seconds / 60)}m ${d.seconds % 60}s — ${d.status}`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-[9px] text-[#3b3d4a]">oldest</span>
          <span className="font-mono text-[9px] text-[#3b3d4a]">latest</span>
        </div>
      </div>
    </div>
  );
}

function CostTrend({
  runs,
  allSteps,
}: {
  runs: Record<string, unknown>[];
  allSteps: Record<string, unknown>[];
}) {
  const data = runs
    .slice(0, 20)
    .reverse()
    .map((run) => {
      const runId = run.id as string;
      const status = run.status as string;
      const runSteps = allSteps.filter((step) => (step.run_id as string) === runId);
      return {
        usd: sumRunEstimatedCostUsd(runSteps),
        status,
      };
    });

  if (data.length < 2) return null;

  const maxUsd = Math.max(...data.map((d) => d.usd), 0.001);

  return (
    <div>
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">AI Cost Trend</h3>
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] px-4 py-3">
        <div className="flex items-end gap-1" style={{ height: 64 }}>
          {data.map((d, i) => {
            const height = Math.max(2, (d.usd / maxUsd) * 56);
            const color =
              d.status === "completed"
                ? "bg-blue-500/70"
                : d.status === "failed"
                ? "bg-red-500/70"
                : "bg-sky-400/70";

            return (
              <div
                key={i}
                className={`flex-1 rounded-t ${color} transition-all`}
                style={{ height }}
                title={`${formatUsd(d.usd)} — ${d.status}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[9px] text-[#3b3d4a]">oldest</span>
          <span className="font-mono text-[9px] text-[#6b6d7a]">
            latest {formatUsd(data[data.length - 1]?.usd ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Step-by-step breakdown for a single expanded run */
function RunStepBreakdown({ steps }: { steps: Record<string, unknown>[] }) {
  // Group by unique step_name, show duration for each
  const stepSummaries: { name: string; status: string; duration: number }[] = [];
  const seen = new Set<string>();

  for (const step of steps) {
    const name = step.step_name as string;
    const artIdx = step.article_index as number;
    // Only show pipeline-level steps (article_index = -1) or first occurrence per step type
    const key = artIdx < 0 ? name : `${name}`;
    if (artIdx >= 0 && seen.has(key)) continue;
    if (artIdx < 0) seen.add(key);

    const started = step.started_at as string | null;
    const ended = extractFinishedAt(step);
    let duration = 0;
    if (started && ended) {
      duration = Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000);
    }

    stepSummaries.push({
      name: (name ?? "unknown").replace(/_/g, " "),
      status: step.status as string,
      duration,
    });
  }

  // Deduplicate: aggregate per step name
  const aggregated = new Map<string, { count: number; totalDuration: number; hasError: boolean }>();
  for (const s of stepSummaries) {
    const existing = aggregated.get(s.name);
    if (existing) {
      existing.count++;
      existing.totalDuration += s.duration;
      if (s.status === "failed") existing.hasError = true;
    } else {
      aggregated.set(s.name, { count: 1, totalDuration: s.duration, hasError: s.status === "failed" });
    }
  }

  return (
    <div className="border-t border-[#1a1b22] bg-[#080910] px-6 py-3">
      <div className="flex flex-wrap gap-3">
        {Array.from(aggregated.entries()).map(([name, data]) => {
          const avgDuration = data.count > 0 ? Math.round(data.totalDuration / data.count) : 0;
          const color = data.hasError ? "text-red-400" : "text-emerald-400/70";
          return (
            <span key={name} className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className={color}>{data.hasError ? "✗" : "✓"}</span>
              <span className="text-[#8b8d9a]">{name}</span>
              <span className="text-[#3b3d4a]">
                {avgDuration}s{data.count > 1 ? ` ×${data.count}` : ""}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
