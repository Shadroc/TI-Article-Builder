"use client";

const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#00AB76",
  Technology: "#067BC2",
  Energy: "#dc6a3f",
  Culture: "#C2C6A2",
  "Food & Health": "#663300",
};

const STEP_LABELS: Record<string, string> = {
  upsert_rss_feed: "Saving",
  generate_article: "Writing",
  process_image: "Image",
  seo_per_site: "SEO",
};

export interface QueueItem {
  id: string;
  title: string;
  category: string;
  status: "idle" | "running" | "complete" | "error" | "skipped";
  sites: string[];
  articleIndex: number;
  /** When set, used to resolve the saved article for preview (from upsert_rss_feed output). */
  rssFeedId?: string;
  currentStep?: string;
  completedStepCount?: number;
  totalStepCount?: number;
}

interface ArticleQueueProps {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ArticleQueue({ items, selectedId, onSelect }: ArticleQueueProps) {
  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-r border-[#1a1b22]">
      <div className="border-b border-[#1a1b22] px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
          Article Queue ({items.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="px-4 py-8 text-center font-mono text-xs text-[#3b3d4a]">
            No articles in queue
          </div>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full border-b border-[#1a1b22] px-4 py-3 text-left transition hover:bg-[#111218] ${
              selectedId === item.id ? "bg-[#111218]" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 font-sans text-xs leading-snug text-[#c8c9d0]">
                {item.title}
              </h3>
              <StatusBadge status={item.status} currentStep={item.currentStep} />
            </div>

            {/* Step progress for running article */}
            {item.status === "running" && item.currentStep && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                  <span className="font-mono text-[10px] text-blue-400">
                    {STEP_LABELS[item.currentStep] ?? item.currentStep.replace(/_/g, " ")}
                  </span>
                  {item.completedStepCount !== undefined && item.totalStepCount !== undefined && (
                    <span className="ml-auto font-mono text-[9px] text-[#3b3d4a]">
                      step {item.completedStepCount}/{item.totalStepCount}
                    </span>
                  )}
                </div>
                {item.completedStepCount !== undefined && item.totalStepCount && item.totalStepCount > 0 && (
                  <div className="mt-1 h-1 rounded-full bg-[#1a1b22] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500/60 transition-all duration-300"
                      style={{ width: `${Math.round((item.completedStepCount / item.totalStepCount) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[item.category] ?? "#555"}20`,
                  color: CATEGORY_COLORS[item.category] ?? "#888",
                }}
              >
                {item.category}
              </span>
              {item.sites.map((s) => (
                <span key={s} className="font-mono text-[9px] uppercase text-emerald-500/60">
                  {s}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, currentStep }: { status: QueueItem["status"]; currentStep?: string }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[9px] text-blue-400">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        {currentStep?.startsWith("publish_") ? "Publishing" : "Processing"}
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] text-emerald-400">
        Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] text-red-400">
        Error
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-600/30 bg-yellow-600/10 px-2 py-0.5 font-mono text-[9px] text-yellow-500">
        Skipped
      </span>
    );
  }
  return <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#3b3d4a]" />;
}
