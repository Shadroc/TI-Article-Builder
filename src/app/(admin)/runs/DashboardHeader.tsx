"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DashboardHeaderProps {
  isRunning: boolean;
  onRun: () => void;
  onTest: () => void;
  onStop: () => Promise<void>;
}

export default function DashboardHeader({ isRunning, onRun, onTest, onStop }: DashboardHeaderProps) {
  const router = useRouter();
  const [isStopping, setIsStopping] = useState(false);

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#1a1b22] bg-[#0a0b0f]/95 px-6 backdrop-blur-sm">
      <div className="flex items-baseline gap-3">
        <h1 className="font-mono text-sm font-bold tracking-tight text-white">
          Article Builder <span className="text-[#3b3d4a]">v2.0</span>
        </h1>
        <span className="font-mono text-[10px] tracking-wider text-[#3b3d4a]">
          N8N → Next.js Pipeline
        </span>
      </div>
      <div className="flex items-center gap-3">
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
              onClick={onRun}
              className="flex items-center gap-2 rounded bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-1.5 font-mono text-xs font-medium text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-emerald-400"
            >
              <span>▶</span> RUN PIPELINE
            </button>
          </>
        )}
      </div>
    </header>
  );
}
