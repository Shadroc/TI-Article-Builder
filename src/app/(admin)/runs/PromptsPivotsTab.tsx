"use client";

import { useState, useTransition } from "react";
import { EditorPrompts, CategoryMap, PivotCatalogs } from "@/integrations/supabase";
import { updateEditorConfig } from "./actions";
import { DEFAULT_PIVOT_CATALOGS } from "@/lib/default-pivot-catalogs";
import { DEFAULT_PROMPTS } from "@/lib/default-editor-prompts";

const PIVOTS = [
  { key: "subjectDescription", label: "Subject description", description: "Main subject of the selected image (from AI Agent)." },
  { key: "colorTarget", label: "Color target", description: "Element to apply brand color to (from AI Agent)." },
  { key: "brandHexColor", label: "Brand hex (pivot)", description: "Category color from Map Category → Hex & ID; passed into selection and edit." },
  { key: "composition_catalog", label: "Composition Catalog", description: "Blueprints for composition (e.g. Wide Establishing Shot, Tight Hero Crop). Injected into image AI." },
  { key: "framing_catalog", label: "Framing Catalog", description: "Camera angle/framing options (e.g. eye-level, low-angle, over-the-shoulder). Injected into image AI." },
  { key: "camera_catalog", label: "Camera Catalog", description: "Camera/sensor style options (e.g. Sony α7R IV, Leica M10). Injected into image AI." },
];

const DEFAULT_CATEGORIES: { name: string; id: number; color: string }[] = [
  { name: "Finance", id: 7, color: "#00AB76" },
  { name: "Technology", id: 6, color: "#067BC2" },
  { name: "Energy", id: 5, color: "#dc6a3f" },
  { name: "Culture", id: 1, color: "#C2C6A2" },
  { name: "Food & Health", id: 4, color: "#663300" },
];

interface PromptsPivotsTabProps {
  editorPrompts: EditorPrompts | null | undefined;
  categoryMap: CategoryMap | null | undefined;
  pivotCatalogs: PivotCatalogs | null | undefined;
}

export default function PromptsPivotsTab({ editorPrompts, categoryMap, pivotCatalogs }: PromptsPivotsTabProps) {
  const [prompts, setPrompts] = useState<EditorPrompts>(() => ({
    ...DEFAULT_PROMPTS,
    ...(editorPrompts ?? {}),
  }));
  const [categories, setCategories] = useState<{ name: string; id: number; color: string }[]>(() =>
    categoryMap && Object.keys(categoryMap).length > 0
      ? Object.entries(categoryMap).map(([name, v]) => ({ name, id: v.id, color: v.color }))
      : DEFAULT_CATEGORIES
  );
  const [pivotCatalogsJson, setPivotCatalogsJson] = useState<string>(() =>
    JSON.stringify(pivotCatalogs ?? DEFAULT_PIVOT_CATALOGS, null, 2)
  );
  const [isPending, startTransition] = useTransition();
  const [savedPrompts, setSavedPrompts] = useState(false);
  const [savedCategories, setSavedCategories] = useState(false);
  const [savedPivots, setSavedPivots] = useState(false);

  function savePrompts() {
    startTransition(async () => {
      const res = await updateEditorConfig({ editor_prompts: prompts });
      if (!res.error) {
        setSavedPrompts(true);
        setTimeout(() => setSavedPrompts(false), 2000);
      }
    });
  }

  function saveCategories() {
    const map: CategoryMap = {};
    for (const c of categories) {
      if (c.name.trim()) map[c.name.trim()] = { id: c.id, color: c.color.trim() || "#CCCCCC" };
    }
    startTransition(async () => {
      const res = await updateEditorConfig({ category_map: map });
      if (!res.error) {
        setSavedCategories(true);
        setTimeout(() => setSavedCategories(false), 2000);
      }
    });
  }

  function addCategory() {
    setCategories((prev) => [...prev, { name: "", id: 0, color: "#666666" }]);
  }

  function removeCategory(index: number) {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCategory(index: number, field: "name" | "id" | "color", value: string | number) {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function savePivotCatalogs() {
    let parsed: PivotCatalogs;
    try {
      parsed = JSON.parse(pivotCatalogsJson) as PivotCatalogs;
    } catch {
      return;
    }
    startTransition(async () => {
      const res = await updateEditorConfig({ pivot_catalogs: parsed });
      if (!res.error) {
        setSavedPivots(true);
        setTimeout(() => setSavedPivots(false), 2000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Image selection (AI Agent) */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Image selection (AI Agent)
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          Placeholders: <code className="text-blue-400">{`{{articleTitle}}`}</code>,{" "}
          <code className="text-blue-400">{`{{category}}`}</code>,{" "}
          <code className="text-blue-400">{`{{colorHint}}`}</code>,{" "}
          <code className="text-blue-400">{`{{imageCount}}`}</code>,{" "}
          <code className="text-blue-400">{`{{imageCountMax}}`}</code>
        </p>
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">System message</label>
            <textarea
              value={prompts.image_selection_system}
              onChange={(e) => setPrompts((p) => ({ ...p, image_selection_system: e.target.value }))}
              rows={2}
              className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">User prompt template</label>
            <textarea
              value={prompts.image_selection_user}
              onChange={(e) => setPrompts((p) => ({ ...p, image_selection_user: e.target.value }))}
              rows={10}
              className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Image edit prompt generator */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Image edit prompt generator
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          Placeholders: <code className="text-blue-400">{`{{subjectDescription}}`}</code>,{" "}
          <code className="text-blue-400">{`{{colorTarget}}`}</code>,{" "}
          <code className="text-blue-400">{`{{hexColor}}`}</code>,{" "}
          <code className="text-blue-400">{`{{headline}}`}</code>
        </p>
        <div className="grid gap-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">System message</label>
            <textarea
              value={prompts.image_edit_system}
              onChange={(e) => setPrompts((p) => ({ ...p, image_edit_system: e.target.value }))}
              rows={10}
              className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">User prompt template</label>
            <textarea
              value={prompts.image_edit_user}
              onChange={(e) => setPrompts((p) => ({ ...p, image_edit_user: e.target.value }))}
              rows={6}
              className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          onClick={savePrompts}
          disabled={isPending}
          className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : savedPrompts ? "✓ Saved" : "Save prompts"}
        </button>
      </div>

      {/* Pivots: Framing – Pivot – catalogs (from n8n node) */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Framing – Pivot – (Composition, Framing, Camera)
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          These catalogs are injected into the image selection and edit-prompt AI. Edit as JSON. Structure: composition_catalog.blueprints[], framing_catalog[], camera_catalog[].
        </p>
        <textarea
          value={pivotCatalogsJson}
          onChange={(e) => setPivotCatalogsJson(e.target.value)}
          rows={24}
          className="mb-3 w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-[11px] leading-relaxed text-white focus:border-blue-500 focus:outline-none"
          spellCheck={false}
        />
        <button
          onClick={savePivotCatalogs}
          disabled={isPending}
          className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : savedPivots ? "✓ Saved" : "Save pivot catalogs"}
        </button>
      </section>

      {/* Pivots (reference) */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Pivots
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          Runtime data and catalog keys. subjectDescription, colorTarget, brandHexColor are derived per run; the three catalogs above are stored and injected into the image AI.
        </p>
        <ul className="space-y-2">
          {PIVOTS.map((p) => (
            <li key={p.key} className="flex items-start gap-3 rounded border border-[#1a1b22] bg-[#050507] px-3 py-2">
              <span className="font-mono text-[11px] font-medium text-blue-400">{p.key}</span>
              <span className="font-mono text-[11px] text-[#6b6d7a]">{p.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Category colors (Map Category → Hex & ID) */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Category colors (Map Category → Hex & ID)
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          Article category → WordPress category id and brand hex. Used for image pivot and per-site mapping.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="border-b border-[#1a1b22] text-left text-[#3b3d4a]">
                <th className="py-2 pr-4">Category name</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Color (hex)</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={i} className="border-b border-[#1a1b22]">
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => updateCategory(i, "name", e.target.value)}
                      placeholder="e.g. Finance"
                      className="w-full min-w-[120px] rounded border border-[#1a1b22] bg-[#050507] px-2 py-1.5 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      value={c.id}
                      onChange={(e) => updateCategory(i, "id", parseInt(e.target.value, 10) || 0)}
                      className="w-20 rounded border border-[#1a1b22] bg-[#050507] px-2 py-1.5 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={c.color}
                      onChange={(e) => updateCategory(i, "color", e.target.value)}
                      placeholder="#00AB76"
                      className="w-24 rounded border border-[#1a1b22] bg-[#050507] px-2 py-1.5 text-white focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeCategory(i)}
                      className="text-[#3b3d4a] hover:text-red-400"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={addCategory}
            className="rounded border border-[#1a1b22] px-3 py-1.5 font-mono text-[11px] text-[#6b6d7a] hover:border-blue-500/40 hover:text-blue-400"
          >
            + Add category
          </button>
          <button
            onClick={saveCategories}
            disabled={isPending}
            className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
          >
            {isPending ? "Saving..." : savedCategories ? "✓ Saved" : "Save category map"}
          </button>
        </div>
      </section>
    </div>
  );
}
