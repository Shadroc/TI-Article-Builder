"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DashboardHeader from "./DashboardHeader";
import PipelineStageTrack, { StageStatus, STAGES } from "./PipelineStageTrack";
import StatsBar from "./StatsBar";
import type { QueueItem } from "./ArticleQueue";
import TerminalLogPanel, { LogEntry } from "./TerminalLogPanel";
import ImageGenerationFlow from "./ImageGenerationFlow";
import ConfigurationTab from "./ConfigurationTab";
import ArticlePreviewTab from "./ArticlePreviewTab";
import PromptsTab from "./PromptsTab";
import PivotsCategoriesTab from "./PivotsCategoriesTab";
import { triggerPipelineRun, triggerTestRun, stopPipelineRun, fetchDashboardData } from "./actions";
import { PipelineConfig } from "@/integrations/supabase";

type Tab = "pipeline" | "config" | "preview" | "prompts" | "pivots";

interface DashboardProps {
  initialRuns: Record<string, unknown>[];
  initialSteps: Record<string, unknown>[];
  initialConfig: PipelineConfig | null;
  initialSites: { id: string; name: string; slug: string }[];
  initialArticles: Record<string, unknown>[];
}

const STEP_TO_STAGE: Record<string, string> = {
  fetch_headlines: "fetch_headlines",
  upsert_rss_feed: "upsert_rss_feed",
  generate_article: "generate_article",
  process_image: "process_image",
  seo_per_site: "seo_per_site",
};

const EXPECTED_STEPS_PER_ARTICLE = 6;

function deriveStageStatuses(steps: Record<string, unknown>[]): Record<string, StageStatus> {
  const statuses: Record<string, StageStatus> = {};
  for (const stage of STAGES) {
    statuses[stage.key] = "idle";
  }

  for (const step of steps) {
    const name = step.step_name as string;
    const status = step.status as string;

    let stageKey = STEP_TO_STAGE[name];
    if (!stageKey && name?.startsWith("publish_")) stageKey = "publish";
    if (!stageKey) continue;

    if (status === "running") {
      statuses[stageKey] = "active";
    } else if (status === "completed") {
      if (statuses[stageKey] !== "active") statuses[stageKey] = "completed";
    } else if (status === "failed") {
      statuses[stageKey] = "error";
    }
  }

  return statuses;
}

function stepsToLogs(steps: Record<string, unknown>[]): LogEntry[] {
  return steps.map((step) => {
    const status = step.status as string;
    const name = (step.step_name as string)?.replace(/_/g, " ") ?? "unknown";
    const artIdx = step.article_index as number;
    const prefix = artIdx >= 0 ? `[${artIdx + 1}] ` : "";
    const output = step.output_summary as string;
    const error = step.error as string;

    let level: LogEntry["level"] = "log";
    let message = `${prefix}${name}`;

    if (status === "completed") {
      level = "success";
      message = output ? `${prefix}${name} — ${output}` : message;
    } else if (status === "failed") {
      level = "error";
      message = error ? `${prefix}${name} — ${error}` : message;
    } else if (status === "running") {
      level = "info";
      message = `${prefix}${name} ...`;
    } else if (status === "skipped") {
      level = "log";
      message = `${prefix}${name} — skipped (duplicate)`;
    }

    return {
      timestamp: (step.started_at as string) ?? new Date().toISOString(),
      level,
      message,
    };
  });
}

function stepsToQueue(steps: Record<string, unknown>[]): QueueItem[] {
  const byArticle: Record<number, Record<string, unknown>[]> = {};
  for (const step of steps) {
    const idx = step.article_index as number;
    if (idx < 0) continue;
    if (!byArticle[idx]) byArticle[idx] = [];
    byArticle[idx].push(step);
  }

  return Object.entries(byArticle).map(([idx, articleSteps]) => {
    const title = (articleSteps[0]?.input_summary as string) ?? `Article ${Number(idx) + 1}`;
    const outputSummary = articleSteps.find((s) => s.step_name === "generate_article")?.output_summary as string;
    const category = outputSummary?.match(/Category:\s*([^,]+)/)?.[1] ?? "Unknown";

    const upsertStep = articleSteps.find((s) => s.step_name === "upsert_rss_feed");
    const rssFeedId =
      upsertStep?.status === "completed" && upsertStep?.output_summary
        ? (upsertStep.output_summary as string).replace(/^Created RSS feed item:\s*/, "").trim() || undefined
        : undefined;

    const hasFailed = articleSteps.some((s) => s.status === "failed");
    const allDone = articleSteps.every((s) => s.status === "completed" || s.status === "skipped");
    const hasRunning = articleSteps.some((s) => s.status === "running");
    const wasSkipped = articleSteps.length === 1 && articleSteps[0].status === "skipped";

    let status: QueueItem["status"] = "idle";
    if (wasSkipped) status = "skipped";
    else if (hasFailed) status = "error";
    else if (allDone) status = "complete";
    else if (hasRunning) status = "running";

    const publishSteps = articleSteps.filter(
      (s) => (s.step_name as string)?.startsWith("publish_") && s.status === "completed"
    );
    const sites = publishSteps.map((s) => (s.step_name as string).replace("publish_", "").toUpperCase());

    const runningStep = articleSteps.find((s) => s.status === "running");
    const completedStepCount = articleSteps.filter(
      (s) => s.status === "completed" || s.status === "skipped"
    ).length;

    return {
      id: `article-${idx}`,
      title,
      category,
      status,
      sites,
      articleIndex: Number(idx),
      rssFeedId,
      currentStep: runningStep ? (runningStep.step_name as string) : undefined,
      completedStepCount,
      totalStepCount: EXPECTED_STEPS_PER_ARTICLE,
    };
  });
}

export default function Dashboard({
  initialRuns,
  initialSteps,
  initialConfig,
  initialSites,
  initialArticles,
}: DashboardProps) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [runs, setRuns] = useState(initialRuns);
  const [steps, setSteps] = useState(initialSteps);
  const [config, setConfig] = useState(initialConfig);
  const [articles, setArticles] = useState(initialArticles);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const latestRun = runs[0] ?? null;
  const isRunning = latestRun?.status === "running";
  const shouldPoll = isRunning || isStarting;

  const poll = useCallback(async () => {
    try {
      const data = await fetchDashboardData();
      setRuns(data.runs);
      setSteps(data.latestSteps);
      setArticles(data.articles);
      setConfig(data.config as PipelineConfig | null);
      if (data.runs[0]?.status !== "running") {
        setIsStarting(false);
      }
    } catch (err) {
      console.error("Poll failed:", err);
    }
  }, []);

  // Poll while running
  useEffect(() => {
    if (!shouldPoll) return;
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [shouldPoll, poll]);

  // Elapsed time counter
  useEffect(() => {
    if (isRunning && latestRun?.started_at) {
      const start = new Date(latestRun.started_at as string).getTime();
      const tick = () => setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    if (!isRunning && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isRunning, latestRun?.started_at]);

  async function handleRun() {
    setIsStarting(true);
    setTab("pipeline");
    try {
      await triggerPipelineRun();
      await poll();
    } catch (err) {
      console.error("Failed to start pipeline:", err);
      setIsStarting(false);
    }
  }

  async function handleTest() {
    setIsStarting(true);
    setTab("pipeline");
    try {
      await triggerTestRun();
      await poll();
    } catch (err) {
      console.error("Failed to start test run:", err);
      setIsStarting(false);
    }
  }

  async function handleStop(): Promise<void> {
    const runId = latestRun?.id as string;
    await stopPipelineRun(runId);
    await poll();
  }

  const stageStatuses = deriveStageStatuses(steps);
  const logs = stepsToLogs(steps);
  const queueItems = stepsToQueue(steps);

  // Derive progress info
  const completedArticles = queueItems.filter((q) => q.status === "complete").length;
  const currentArticleIdx = queueItems.findIndex((q) => q.status === "running");
  const headlineFetchStep = steps.find((s) => s.step_name === "fetch_headlines" && s.status === "completed");
  const totalArticleCount = headlineFetchStep
    ? Number((headlineFetchStep.output_summary as string)?.match(/\d+/)?.[0] ?? 0)
    : queueItems.length;

  // Stats
  const total = queueItems.length;
  const published = completedArticles;
  const pending = queueItems.filter((q) => q.status === "idle" || q.status === "running").length;

  const categoryCounts: Record<string, number> = {};
  for (const q of queueItems) {
    if (q.category && q.category !== "Unknown") {
      categoryCounts[q.category] = (categoryCounts[q.category] ?? 0) + 1;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      <DashboardHeader
        isRunning={isRunning || isStarting}
        onRun={handleRun}
        onTest={handleTest}
        onStop={handleStop}
      />

      <div className="pt-14">
        <PipelineStageTrack
          stageStatuses={stageStatuses}
          currentArticle={currentArticleIdx >= 0 ? currentArticleIdx : completedArticles}
          totalArticles={totalArticleCount}
          elapsedSeconds={isRunning ? elapsedSeconds : undefined}
        />

        {(total > 0 || isRunning) && (
          <StatsBar
            total={total}
            published={published}
            pending={pending}
            categoryCounts={categoryCounts}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#1a1b22] px-6">
          {(["pipeline", "config", "preview", "prompts", "pivots"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-4 py-2 font-mono text-xs transition ${
                tab === t
                  ? "border-blue-500 text-white"
                  : "border-transparent text-[#3b3d4a] hover:text-[#6b6d7a]"
              }`}
            >
              {t === "pipeline"
                ? "Pipeline"
                : t === "config"
                ? "Configuration"
                : t === "preview"
                ? "Article Preview"
                : t === "prompts"
                ? "Prompts"
                : "Pivots & Categories"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[500px]">
          {tab === "pipeline" && (
            <div className="flex flex-col gap-4 p-4">
              <div className="h-[500px] shrink-0">
                <TerminalLogPanel logs={logs} isRunning={isRunning || isStarting} />
              </div>
            </div>
          )}

          {tab === "config" && (
            <ConfigurationTab config={config} sites={initialSites} onSaved={poll} />
          )}

          {tab === "prompts" && (
            <div className="flex flex-col gap-4 p-4">
              <ImageGenerationFlow />
              <PromptsTab
                editorPrompts={config?.editor_prompts ?? undefined}
                onSaved={poll}
              />
            </div>
          )}

          {tab === "pivots" && (
            <PivotsCategoriesTab
              categoryMap={config?.category_map ?? undefined}
              pivotCatalogs={config?.pivot_catalogs ?? undefined}
            />
          )}

          {tab === "preview" && (
            <ArticlePreviewTab
              items={queueItems}
              selectedId={selectedArticleId}
              onSelect={setSelectedArticleId}
              articles={articles}
            />
          )}
        </div>
      </div>
    </div>
  );
}
