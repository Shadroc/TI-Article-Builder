"use client";

interface RunDot {
  id: string;
  status: string;
  duration_seconds?: number;
}

interface RunSparklineProps {
  runs: RunDot[];
}

export default function RunSparkline({ runs }: RunSparklineProps) {
  if (runs.length === 0) return null;

  // Show last 20 runs, oldest first (left to right)
  const display = runs.slice(0, 20).reverse();

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Last ${display.length} runs: ${display.filter(r => r.status === "completed").length} succeeded, ${display.filter(r => r.status === "failed").length} failed`} title={`Last ${display.length} runs`}>
      {display.map((run) => {
        const color =
          run.status === "completed"
            ? "bg-emerald-500"
            : run.status === "failed"
            ? "bg-red-500"
            : run.status === "running"
            ? "bg-blue-500 animate-pulse"
            : "bg-[#3b3d4a]";

        return (
          <span
            key={run.id}
            className={`inline-block h-2 w-2 rounded-full ${color}`}
            title={`${run.status}${run.duration_seconds ? ` — ${formatDuration(run.duration_seconds)}` : ""}`}
          />
        );
      })}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
