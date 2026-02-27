"use client";

const STAGES = [
  { key: "fetch_headlines", icon: "01", label: "Fetch Headlines" },
  { key: "upsert_rss_feed", icon: "02", label: "Save to DB" },
  { key: "generate_article", icon: "03", label: "Write Article" },
  { key: "process_image", icon: "04", label: "Process Image" },
  { key: "seo_per_site", icon: "05", label: "SEO Rewrite" },
  { key: "publish", icon: "06", label: "Publish WP" },
] as const;

export type StageStatus = "idle" | "active" | "completed" | "error";

interface PipelineStageTrackProps {
  stageStatuses: Record<string, StageStatus>;
  currentArticle?: number;
  totalArticles?: number;
  elapsedSeconds?: number;
}

export default function PipelineStageTrack({
  stageStatuses,
  currentArticle,
  totalArticles,
  elapsedSeconds,
}: PipelineStageTrackProps) {
  const isActive = Object.values(stageStatuses).some((s) => s === "active");

  return (
    <div className="border-b border-[#1a1b22] px-6 py-4">
      {/* Progress summary bar */}
      {(isActive || (totalArticles && totalArticles > 0)) && (
        <div className="mb-3 flex items-center gap-4">
          {isActive && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <span className="font-mono text-xs text-blue-400">RUNNING</span>
            </div>
          )}
          {totalArticles !== undefined && totalArticles > 0 && (
            <span className="font-mono text-xs text-[#6b6d7a]">
              Article {(currentArticle ?? 0) + 1} / {totalArticles}
            </span>
          )}
          {elapsedSeconds !== undefined && elapsedSeconds > 0 && (
            <span className="font-mono text-xs text-[#3b3d4a]">
              {formatElapsed(elapsedSeconds)}
            </span>
          )}
          {totalArticles !== undefined && totalArticles > 0 && (
            <div className="ml-auto flex-1 max-w-[300px]">
              <ProgressBar
                current={currentArticle ?? 0}
                total={totalArticles}
              />
            </div>
          )}
        </div>
      )}

      {/* Stage track */}
      <div className="flex items-center gap-0 overflow-x-auto">
        {STAGES.map((stage, i) => {
          const status = stageStatuses[stage.key] ?? "idle";
          return (
            <div key={stage.key} className="flex items-center">
              <div
                className={`relative flex w-[110px] flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-all ${
                  status === "active"
                    ? "border-blue-500/60 bg-blue-500/5"
                    : status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : status === "error"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-[#1a1b22] bg-[#0d0e13]"
                }`}
              >
                {status === "active" && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                  </span>
                )}
                <span
                  className={`font-mono text-[10px] font-bold ${
                    status === "active"
                      ? "text-blue-400"
                      : status === "completed"
                      ? "text-emerald-400"
                      : status === "error"
                      ? "text-red-400"
                      : "text-[#3b3d4a]"
                  }`}
                >
                  {stage.icon}
                </span>
                <span
                  className={`text-center font-mono text-[9px] leading-tight ${
                    status === "active"
                      ? "text-blue-300"
                      : status === "completed"
                      ? "text-emerald-300/70"
                      : "text-[#6b6d7a]"
                  }`}
                >
                  {stage.label}
                </span>
                <div
                  className={`h-[2px] w-full rounded-full transition-all ${
                    status === "completed"
                      ? "bg-emerald-500"
                      : status === "error"
                      ? "bg-red-500"
                      : status === "active"
                      ? "bg-blue-500 animate-pulse"
                      : "bg-[#1a1b22]"
                  }`}
                />
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-px w-4 transition-all ${
                    status === "completed" ? "bg-emerald-500/40" : "bg-[#1a1b22]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[#1a1b22] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-[#3b3d4a]">{pct}%</span>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export { STAGES };
