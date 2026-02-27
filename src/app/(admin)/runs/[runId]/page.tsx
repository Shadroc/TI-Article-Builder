import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

async function getRunDetail(runId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const db = createClient(url, key);

  const [runResult, stepsResult] = await Promise.all([
    db.from("workflow_runs").select("*").eq("id", runId).single(),
    db
      .from("workflow_steps")
      .select("*")
      .eq("run_id", runId)
      .order("article_index")
      .order("started_at"),
  ]);

  if (runResult.error) return null;
  return { run: runResult.data, steps: stepsResult.data ?? [] };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "border-blue-500/40 text-blue-400",
    completed: "border-emerald-500/40 text-emerald-400",
    failed: "border-red-500/40 text-red-400",
    cancelled: "border-yellow-500/40 text-yellow-400",
    skipped: "border-[#3b3d4a] text-[#3b3d4a]",
  };

  return (
    <span className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] ${styles[status] ?? "border-[#3b3d4a] text-[#3b3d4a]"}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function durationMs(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const data = await getRunDetail(runId);
  if (!data) notFound();

  const { run, steps } = data;

  const stepsByArticle = steps.reduce<Record<number, typeof steps>>((acc, step) => {
    const idx = step.article_index as number;
    if (!acc[idx]) acc[idx] = [];
    acc[idx].push(step);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0a0b0f] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/runs" className="font-mono text-xs text-blue-400 hover:text-blue-300">
          ← Back to Dashboard
        </Link>

        <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-mono text-sm font-bold text-white">Pipeline Run</h1>
              <p className="mt-1 font-mono text-[10px] text-[#3b3d4a]">{run.id}</p>
            </div>
            <StatusBadge status={run.status} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Trigger</span>
              <p className="mt-0.5 font-mono text-xs capitalize text-[#8b8d9a]">{run.trigger}</p>
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Articles</span>
              <p className="mt-0.5 font-mono text-xs text-[#8b8d9a]">{run.article_count ?? 0}</p>
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Started</span>
              <p className="mt-0.5 font-mono text-xs text-[#8b8d9a]">{formatDate(run.started_at)}</p>
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Duration</span>
              <p className="mt-0.5 font-mono text-xs text-[#8b8d9a]">{durationMs(run.started_at, run.finished_at)}</p>
            </div>
          </div>
          {run.error && (
            <div className="mt-4 rounded border border-red-500/20 bg-red-500/5 p-3 font-mono text-xs text-red-400">
              {run.error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#3b3d4a]">Steps</h2>
          {Object.entries(stepsByArticle)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([articleIdx, articleSteps]) => (
              <div key={articleIdx} className="rounded-lg border border-[#1a1b22] overflow-hidden">
                <div className="border-b border-[#1a1b22] bg-[#0d0e13] px-4 py-2 font-mono text-[11px] text-[#6b6d7a]">
                  {Number(articleIdx) === -1 ? "Pipeline-level" : `Article #${Number(articleIdx) + 1}`}
                  {articleSteps[0]?.input_summary && (
                    <span className="ml-2 text-[#3b3d4a]">— {articleSteps[0].input_summary as string}</span>
                  )}
                </div>
                <div className="divide-y divide-[#1a1b22]">
                  {articleSteps.map((step) => (
                    <div key={step.id as string} className="flex items-start gap-3 px-4 py-2.5">
                      <StatusBadge status={step.status as string} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-[#8b8d9a]">
                          {(step.step_name as string).replace(/_/g, " ")}
                        </p>
                        {step.output_summary && (
                          <p className="mt-0.5 font-mono text-[10px] text-[#3b3d4a]">{step.output_summary as string}</p>
                        )}
                        {step.error && (
                          <p className="mt-1 font-mono text-[10px] text-red-400">{step.error as string}</p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-[#3b3d4a]">
                        {durationMs(step.started_at as string, step.finished_at as string | null)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
