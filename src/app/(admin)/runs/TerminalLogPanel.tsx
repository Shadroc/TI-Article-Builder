"use client";

import { useRef, useEffect } from "react";

export interface LogEntry {
  timestamp: string;
  level: "success" | "error" | "info" | "log";
  message: string;
}

interface TerminalLogPanelProps {
  logs: LogEntry[];
  isRunning?: boolean;
}

const PREFIX: Record<LogEntry["level"], { symbol: string; color: string }> = {
  success: { symbol: "✓", color: "text-emerald-400" },
  error: { symbol: "✗", color: "text-red-400" },
  info: { symbol: "›", color: "text-blue-400" },
  log: { symbol: "·", color: "text-[#3b3d4a]" },
};

export default function TerminalLogPanel({ logs, isRunning }: TerminalLogPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg border border-[#1a1b22] bg-[#050507]">
      <div className="flex items-center gap-2 border-b border-[#1a1b22] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500/60" />
        <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
        <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
        <span className="ml-2 font-mono text-[10px] text-[#3b3d4a]">pipeline.log</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-blue-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            streaming
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[#3b3d4a]">
          {logs.length} entries
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {logs.length === 0 && !isRunning && (
          <div className="font-mono text-xs text-[#3b3d4a]">
            No logs. Click RUN PIPELINE to start.
          </div>
        )}
        {logs.length === 0 && isRunning && (
          <div className="flex items-center gap-2 font-mono text-xs text-blue-400">
            <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-blue-400" />
            Starting pipeline...
          </div>
        )}
        {logs.map((log, i) => {
          const pref = PREFIX[log.level];
          const isLast = i === logs.length - 1;
          return (
            <div
              key={i}
              className={`flex gap-2 font-mono text-[11px] leading-5 ${
                isLast && log.level === "info" ? "animate-pulse" : ""
              }`}
            >
              <span className="shrink-0 text-[#3b3d4a]">
                {formatTime(log.timestamp)}
              </span>
              <span className={`shrink-0 ${pref.color}`}>{pref.symbol}</span>
              <span
                className={
                  log.level === "error"
                    ? "text-red-300"
                    : log.level === "success"
                    ? "text-emerald-300/80"
                    : log.level === "info"
                    ? "text-blue-300"
                    : "text-[#8b8d9a]"
                }
              >
                {log.message}
              </span>
            </div>
          );
        })}
        {isRunning && logs.length > 0 && (
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] leading-5 text-[#3b3d4a]">
            <span className="inline-block h-1 w-1 animate-ping rounded-full bg-blue-500" />
            <span className="animate-pulse">waiting...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}
