"use client";

import { useState, useTransition, useEffect } from "react";
import { CategoryMap } from "@/integrations/supabase";
import { updateEditorConfig, updateSiteCategoryMap } from "./actions";

const DEFAULT_CATEGORIES: { name: string; id: number; color: string }[] = [
  { name: "Finance", id: 7, color: "#00AB76" },
  { name: "Technology", id: 6, color: "#067BC2" },
  { name: "Energy", id: 5, color: "#dc6a3f" },
  { name: "Culture", id: 1, color: "#C2C6A2" },
  { name: "Food & Health", id: 4, color: "#663300" },
];

interface SiteWithCategories {
  id: string;
  name: string;
  slug: string;
  category_map?: Record<string, { id: number; color: string }> | null;
}

interface CategoriesTabProps {
  globalCategoryMap: CategoryMap | null | undefined;
  sites: SiteWithCategories[];
  onSaved?: () => void;
}

function CategoryEditor({
  categories,
  onUpdate,
  onAdd,
  onRemove,
  onSave,
  isPending,
  saved,
}: {
  categories: { name: string; id: number; color: string }[];
  onUpdate: (index: number, field: "name" | "id" | "color", value: string | number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  isPending: boolean;
  saved: boolean;
}) {
  return (
    <div className="space-y-2">
      {categories.map((c, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded border border-[#1a1b22] bg-[#050507] p-2"
        >
          <input
            type="text"
            value={c.name}
            onChange={(e) => onUpdate(i, "name", e.target.value)}
            placeholder="Category name"
            className="min-w-[100px] flex-1 rounded border border-[#1a1b22] bg-[#0d0e13] px-2 py-1.5 font-mono text-[11px] text-white focus:border-blue-500 focus:outline-none"
          />
          <input
            type="number"
            value={c.id}
            onChange={(e) => onUpdate(i, "id", parseInt(e.target.value, 10) || 0)}
            placeholder="ID"
            className="w-14 rounded border border-[#1a1b22] bg-[#0d0e13] px-2 py-1.5 font-mono text-[11px] text-white focus:border-blue-500 focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={c.color}
              onChange={(e) => onUpdate(i, "color", e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-[#1a1b22] bg-transparent p-0"
              title={c.color}
            />
            <input
              type="text"
              value={c.color}
              onChange={(e) => onUpdate(i, "color", e.target.value)}
              className="w-20 rounded border border-[#1a1b22] bg-[#0d0e13] px-2 py-1.5 font-mono text-[11px] text-white focus:border-blue-500 focus:outline-none"
              placeholder="#hex"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="rounded p-1 text-[#3b3d4a] transition hover:bg-red-500/20 hover:text-red-400"
            title="Delete category"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-[#1a1b22] px-3 py-1.5 font-mono text-[11px] text-[#6b6d7a] transition hover:border-blue-500/40 hover:text-blue-400"
        >
          + Add category
        </button>
        <button
          onClick={onSave}
          disabled={isPending}
          className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-[11px] text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : saved ? "✓ Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function CategoriesTab({
  globalCategoryMap,
  sites,
  onSaved,
}: CategoriesTabProps) {
  const [globalCategories, setGlobalCategories] = useState<
    { name: string; id: number; color: string }[]
  >(() =>
    globalCategoryMap && Object.keys(globalCategoryMap).length > 0
      ? Object.entries(globalCategoryMap).map(([name, v]) => ({
          name,
          id: v.id,
          color: v.color,
        }))
      : DEFAULT_CATEGORIES
  );

  const [siteCategories, setSiteCategories] = useState<
    Record<string, { name: string; id: number; color: string }[]>
  >(() => {
    const out: Record<string, { name: string; id: number; color: string }[]> = {};
    for (const site of sites) {
      const map = site.category_map ?? {};
      out[site.id] =
        Object.keys(map).length > 0
          ? Object.entries(map).map(([name, v]) => ({ name, id: v.id, color: v.color }))
          : [];
    }
    return out;
  });

  useEffect(() => {
    setSiteCategories((prev) => {
      const next = { ...prev };
      for (const site of sites) {
        if (!(site.id in next)) {
          const map = site.category_map ?? {};
          next[site.id] =
            Object.keys(map).length > 0
              ? Object.entries(map).map(([name, v]) => ({ name, id: v.id, color: v.color }))
              : [];
        }
      }
      return next;
    });
  }, [sites]);

  const [isPending, startTransition] = useTransition();
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [savedSiteId, setSavedSiteId] = useState<string | null>(null);

  function saveGlobal() {
    const map: CategoryMap = {};
    for (const c of globalCategories) {
      if (c.name.trim())
        map[c.name.trim()] = { id: c.id, color: c.color.trim() || "#CCCCCC" };
    }
    startTransition(async () => {
      const res = await updateEditorConfig({ category_map: map });
      if (!res.error) {
        setSavedGlobal(true);
        setTimeout(() => setSavedGlobal(false), 2000);
        onSaved?.();
      }
    });
  }

  function saveSite(siteId: string) {
    const cats = siteCategories[siteId] ?? [];
    const map: Record<string, { id: number; color: string }> = {};
    for (const c of cats) {
      if (c.name.trim())
        map[c.name.trim()] = { id: c.id, color: c.color.trim() || "#CCCCCC" };
    }
    startTransition(async () => {
      const res = await updateSiteCategoryMap(siteId, map);
      if (!res.error) {
        setSavedSiteId(siteId);
        setTimeout(() => setSavedSiteId(null), 2000);
        onSaved?.();
      }
    });
  }

  function addGlobal() {
    setGlobalCategories((prev) => [...prev, { name: "", id: 0, color: "#666666" }]);
  }

  function addSite(siteId: string) {
    setSiteCategories((prev) => ({
      ...prev,
      [siteId]: [...(prev[siteId] ?? []), { name: "", id: 0, color: "#666666" }],
    }));
  }

  function updateGlobal(index: number, field: "name" | "id" | "color", value: string | number) {
    setGlobalCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateSite(siteId: string, index: number, field: "name" | "id" | "color", value: string | number) {
    setSiteCategories((prev) => {
      const list = prev[siteId] ?? [];
      const next = [...list];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [siteId]: next };
    });
  }

  function removeGlobal(index: number) {
    setGlobalCategories((prev) => prev.filter((_, i) => i !== index));
  }

  function removeSite(siteId: string, index: number) {
    setSiteCategories((prev) => ({
      ...prev,
      [siteId]: (prev[siteId] ?? []).filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Global default (pipeline_config) */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Global category map (default)
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          Used for article generation fallback and image brand colors. Applied when a site has no
          mapping for an article category.
        </p>
        <CategoryEditor
          categories={globalCategories}
          onUpdate={updateGlobal}
          onAdd={addGlobal}
          onRemove={removeGlobal}
          onSave={saveGlobal}
          isPending={isPending}
          saved={savedGlobal}
        />
      </section>

      {/* Per-site category maps */}
      <section>
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Per-site category maps
        </h2>
        <p className="mb-4 font-mono text-[11px] text-[#3b3d4a]">
          Map article categories to each site&apos;s WordPress category IDs. Each site can use
          different IDs for the same category name.
        </p>
        <div className="flex flex-col gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-sm font-medium text-white">
                  {site.name}
                  <span className="ml-2 font-mono text-[10px] text-[#6b6d7a]">({site.slug})</span>
                </h3>
              </div>
              <CategoryEditor
                categories={siteCategories[site.id] ?? []}
                onUpdate={(i, f, v) => updateSite(site.id, i, f, v)}
                onAdd={() => addSite(site.id)}
                onRemove={(i) => removeSite(site.id, i)}
                onSave={() => saveSite(site.id)}
                isPending={isPending}
                saved={savedSiteId === site.id}
              />
            </div>
          ))}
          {sites.length === 0 && (
            <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-6 font-mono text-[11px] text-[#3b3d4a]">
              No active sites. Add sites in Supabase to configure per-site categories.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
