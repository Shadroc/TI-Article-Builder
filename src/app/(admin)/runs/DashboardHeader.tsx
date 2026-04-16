"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import RunSparkline from "./RunSparkline";
import { extractFinishedAt } from "./runMetrics";

interface DashboardHeaderProps {
  isRunning: boolean;
  onRun: () => void;
  onTest: () => void;
  onStop: () => Promise<void>;
  runs?: Record<string, unknown>[];
  onConfirmRun?: () => void;
}

export default function DashboardHeader({ isRunning, onRun, onTest, onStop, runs = [] }: DashboardHeaderProps) {
  const router = useRouter();
  const [isStopping, setIsStopping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape to dismiss confirmation dialog
  useEffect(() => {
    if (!showConfirm) return;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowConfirm(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showConfirm]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/runs/login");
    router.refresh();
  }

  async function handleStop() {
    setIsStopping(true);
    try {
      await onStop();
    } finally {
      setIsStopping(false);
    }
  }

  function handleRunClick() {
    setShowConfirm(true);
  }

  function handleConfirmRun() {
    setShowConfirm(false);
    onRun();
  }

  const sparklineDots = runs.map((r) => ({
    id: r.id as string,
    status: r.status as string,
    duration_seconds: r.started_at && extractFinishedAt(r)
      ? Math.round((new Date(extractFinishedAt(r) as string).getTime() - new Date(r.started_at as string).getTime()) / 1000)
      : undefined,
  }));

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#1a1b22] bg-[#0a0b0f]/95 px-4 backdrop-blur-sm sm:px-6" role="banner">
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="font-mono text-xs font-bold tracking-tight text-white sm:text-sm">
            Article Builder
          </h1>
          <RunSparkline runs={sparklineDots} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleLogout}
            className="rounded border border-[#2a2b35] px-3 py-1.5 font-mono text-[10px] text-[#6b6d7a] transition hover:border-[#3b3d4a] hover:text-[#8b8d9a]"
            title="Sign out"
          >
            LOGOUT
          </button>
          {isRunning && (
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#3b3d4a]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              running
            </span>
          )}
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={isStopping}
              className="flex items-center gap-2 rounded border border-red-500/40 bg-transparent px-4 py-1.5 font-mono text-xs font-medium text-red-400 transition hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStopping ? (
                <>
                  <span className="inline-block h-2 w-2 animate-spin rounded-full border border-red-400 border-t-transparent" />
                  STOPPING...
                </>
              ) : (
                <>
                  <span>■</span> STOP PIPELINE
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={onTest}
                className="flex items-center gap-2 rounded border border-[#2a2b35] bg-[#0d0e13] px-4 py-1.5 font-mono text-xs font-medium text-[#6b6d7a] transition hover:border-blue-500/40 hover:text-blue-400"
                title="Process 1 article to verify the pipeline"
              >
                <span className="text-[10px]">⚡</span> TEST RUN
              </button>
              <button
                onClick={handleRunClick}
                className="flex items-center gap-2 rounded bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-1.5 font-mono text-xs font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-emerald-400"
              >
                <span>▶</span> RUN PIPELINE
              </button>
            </>
          )}
        </div>
      </header>

      {/* Confirmation dialog for live pipeline run */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
          <div ref={confirmRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-6 shadow-2xl outline-none">
            <h2 id="confirm-dialog-title" className="font-mono text-sm font-bold text-white">Confirm Pipeline Run</h2>
            <p className="mt-2 font-mono text-xs leading-relaxed text-[#8b8d9a]">
              This will fetch headlines, generate articles, and <span className="text-white">publish to live WordPress sites</span>. Use <span className="text-blue-400">TEST RUN</span> to verify first.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded border border-[#2a2b35] px-4 py-1.5 font-mono text-xs text-[#6b6d7a] transition hover:border-[#3b3d4a] hover:text-[#8b8d9a]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRun}
                className="rounded bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-1.5 font-mono text-xs font-medium text-white transition hover:from-emerald-500 hover:to-emerald-400"
              >
                Run Pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
