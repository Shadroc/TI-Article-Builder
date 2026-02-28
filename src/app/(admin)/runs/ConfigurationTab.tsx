"use client";

import { useState, useTransition } from "react";
import { PipelineConfig } from "@/integrations/supabase";
import { updatePipelineConfig } from "./actions";

interface ConfigurationTabProps {
  config: PipelineConfig | null;
  sites: { id: string; name: string; slug: string }[];
  onSaved?: () => void;
}

const WRITER_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "gpt-4o", label: "GPT-4o" },
];

const IMAGE_MODELS = [
  { value: "gpt-image-1", label: "GPT Image 1" },
  { value: "dall-e-3", label: "DALL-E 3" },
];

type HeadlinesDateMode = "today" | "yesterday" | "custom";

/** Convert MMDDYYYY to YYYY-MM-DD for date inputs */
function mmddyyyyToInputValue(s: string): string {
  if (s.length !== 8) return "";
  const mm = s.slice(0, 2);
  const dd = s.slice(2, 4);
  const yyyy = s.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD to MMDDYYYY */
function inputValueToMmddyyyy(s: string): string {
  if (!s || s.length < 10) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${m.padStart(2, "0")}${d.padStart(2, "0")}${y}`;
}

/** Parse MMDDYYYY-MMDDYYYY into { start: YYYY-MM-DD, end: YYYY-MM-DD } */
function parseCustomRange(value: string): { start: string; end: string } {
  const parts = value.split("-");
  if (parts.length < 2) return { start: "", end: "" };
  const startPart = parts[0] ?? "";
  const endPart = parts[1] ?? "";
  if (startPart.length !== 8 || endPart.length !== 8) {
    return { start: "", end: "" };
  }
  return {
    start: mmddyyyyToInputValue(startPart),
    end: mmddyyyyToInputValue(endPart),
  };
}

export default function ConfigurationTab({ config, sites, onSaved }: ConfigurationTabProps) {
  const [local, setLocal] = useState<PipelineConfig | null>(config);
  const [headlinesDateMode, setHeadlinesDateMode] = useState<HeadlinesDateMode>(() => {
    const d = config?.headlines_date;
    if (d === "today" || d === "yesterday") return d;
    if (d?.trim()) return "custom";
    return "today";
  });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  if (!local) return <div className="p-6 font-mono text-xs text-[#3b3d4a]">No config loaded</div>;

  function save() {
    if (!local) return;
    const toSave = { ...local };
    if (headlinesDateMode === "today" || headlinesDateMode === "yesterday") {
      toSave.headlines_date = headlinesDateMode;
    } else if (headlinesDateMode === "custom" && !toSave.headlines_date?.trim()) {
      toSave.headlines_date = "today";
    }
    startTransition(async () => {
      const result = await updatePipelineConfig(toSave);
      if (result?.error) {
        console.error("Config save failed:", result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    });
  }

  const targetSites = local.target_sites ?? [];

  function toggleSite(slug: string) {
    const next = targetSites.includes(slug)
      ? targetSites.filter((s) => s !== slug)
      : [...targetSites, slug];
    setLocal({ ...local!, target_sites: next });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Headlines to fetch */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            Headlines to Fetch
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={local.headlines_to_fetch}
            onChange={(e) => setLocal({ ...local, headlines_to_fetch: Number(e.target.value) })}
            className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Headlines date */}
        <div className="col-span-2">
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            Headlines Date
          </label>
          <div className="flex gap-3 items-end">
            <select
              value={headlinesDateMode}
              onChange={(e) => {
                const v = e.target.value as HeadlinesDateMode;
                setHeadlinesDateMode(v);
                setLocal({
                  ...local,
                  headlines_date:
                    v === "custom"
                      ? (local.headlines_date && local.headlines_date !== "today" && local.headlines_date !== "yesterday"
                          ? local.headlines_date
                          : "")
                      : v,
                });
              }}
              className="rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="custom">Custom range</option>
            </select>
            {headlinesDateMode === "custom" ? (
              <div className="flex flex-1 gap-3 items-end">
                {(() => {
                  const raw = local.headlines_date ?? "";
                  const isValid =
                    raw &&
                    raw !== "today" &&
                    raw !== "yesterday" &&
                    /^\d{8}-\d{8}$/.test(raw);
                  const { start, end } = isValid ? parseCustomRange(raw) : { start: "", end: "" };
                  return (
                    <>
                      <div className="flex-1">
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-[#6b6d7a]">
                          Start
                        </label>
                        <input
                          type="date"
                          value={start}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            const newEnd = end || newStart;
                            const apiFormat = `${inputValueToMmddyyyy(newStart)}-${inputValueToMmddyyyy(newEnd)}`;
                            setLocal({
                              ...local,
                              headlines_date: apiFormat,
                            });
                          }}
                          className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-[#6b6d7a]">
                          End
                        </label>
                        <input
                          type="date"
                          value={end}
                          min={start || undefined}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            const newStart = start || newEnd;
                            const apiFormat = `${inputValueToMmddyyyy(newStart)}-${inputValueToMmddyyyy(newEnd)}`;
                            setLocal({
                              ...local,
                              headlines_date: apiFormat,
                            });
                          }}
                          className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>

        {/* Publish status */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            Publish Status
          </label>
          <select
            value={local.publish_status}
            onChange={(e) => setLocal({ ...local, publish_status: e.target.value as "draft" | "publish" })}
            className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="draft">Draft</option>
            <option value="publish">Publish</option>
          </select>
        </div>

        {/* Target sites */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            Target Sites
          </label>
          <div className="flex gap-2">
            {sites.map((site) => (
              <button
                key={site.slug}
                onClick={() => toggleSite(site.slug)}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition ${
                  targetSites.includes(site.slug)
                    ? "border-blue-500/60 bg-blue-500/10 text-blue-400"
                    : "border-[#1a1b22] bg-[#0d0e13] text-[#3b3d4a] hover:border-[#3b3d4a]"
                }`}
              >
                {site.name}
              </button>
            ))}
          </div>
        </div>

        {/* Writer model */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            AI Writer Model
          </label>
          <select
            value={local.writer_model}
            onChange={(e) => setLocal({ ...local, writer_model: e.target.value })}
            className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {WRITER_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Image model */}
        <div>
          <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
            Image Model
          </label>
          <select
            value={local.image_model}
            onChange={(e) => setLocal({ ...local, image_model: e.target.value })}
            className="w-full rounded border border-[#1a1b22] bg-[#0d0e13] px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Save button */}
        <div className="flex items-end">
          <button
            onClick={save}
            disabled={isPending}
            className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
          >
            {isPending ? "Saving..." : saved ? "✓ Saved" : "Save Configuration"}
          </button>
        </div>
      </div>

      {/* ASCII pipeline diagram */}
      <div className="rounded-lg border border-[#1a1b22] bg-[#050507] p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
          Pipeline Architecture
        </div>
        <pre className="font-mono text-[11px] leading-5 text-[#6b6d7a]">{`
┌─────────────────────────────────────────────────────────────────────┐
│  TRIGGER (Cron 06:00 UTC / Manual)                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  📡 StockNewsAPI → Fetch Trending Headlines                         │
│  └─ Split into individual articles                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FOR EACH ARTICLE:                                                   │
│  ├─ 💾 Upsert to rss_feed (skip duplicates)                         │
│  ├─ 🔍 Jina AI → Search references                                  │
│  ├─ ✍️  Anthropic Claude → Write HTML article                        │
│  ├─ 🏷️  Extract category, tags, headline                             │
│  ├─ 🖼️  Image pipeline:                                              │
│  │   ├─ Stock image exists? → Download                               │
│  │   └─ No? → Google CSE → Download candidates                      │
│  │   ├─ GPT-4o Vision → Select best image                           │
│  │   ├─ GPT Image → Edit with brand colors                          │
│  │   └─ Sharp → Resize 900×600 WebP                                 │
│  ├─ 🔍 OpenAI → Per-site SEO rewrite                                │
│  ├─ 🚀 WordPress → Upload media + Create draft + Set featured       │
│  └─ ✅ Save to ai_articles                                           │
└──────────────────────────────────────────────────────────────────────┘`}
        </pre>
      </div>

      {/* API integrations grid */}
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
          API Integrations
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: "StockNewsAPI", key: "STOCKNEWS_API_TOKEN" },
            { name: "Anthropic Claude", key: "ANTHROPIC_API_KEY" },
            { name: "OpenAI", key: "OPENAI_API_KEY" },
            { name: "Google CSE", key: "GOOGLE_CSE_API_KEY" },
            { name: "Jina AI", key: "JINA_API_KEY" },
            { name: "Supabase", key: "SUPABASE_SECRET_KEY" },
            { name: "WordPress (TI)", key: "WORDPRESS_SITES" },
            { name: "WordPress (MT)", key: "WORDPRESS_SITES" },
          ].map((svc) => (
            <div key={svc.name} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[11px] text-[#6b6d7a]">{svc.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
