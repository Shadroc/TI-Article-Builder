"use client";

import { useState, useTransition } from "react";
import { PivotCatalogs } from "@/integrations/supabase";
import { updateEditorConfig } from "./actions";
import { DEFAULT_PIVOT_CATALOGS } from "@/lib/default-pivot-catalogs";

const PIVOTS = [
  { key: "subjectDescription", label: "Subject description", description: "Main subject of the selected image (from AI Agent)." },
  { key: "colorTarget", label: "Color target", description: "Element to apply brand color to (from AI Agent)." },
  { key: "brandHexColor", label: "Brand hex (pivot)", description: "Category color from Categories tab; passed into selection and edit." },
  { key: "composition_catalog", label: "Composition Catalog", description: "Blueprints for composition (e.g. Wide Establishing Shot, Tight Hero Crop). Injected into image AI." },
  { key: "framing_catalog", label: "Framing Catalog", description: "Camera angle/framing options (e.g. eye-level, low-angle, over-the-shoulder). Injected into image AI." },
  { key: "camera_catalog", label: "Camera Catalog", description: "Camera/sensor style options (e.g. Sony α7R IV, Leica M10). Injected into image AI." },
];

interface PivotsTabProps {
  pivotCatalogs: PivotCatalogs | null | undefined;
}

export default function PivotsTab({ pivotCatalogs }: PivotsTabProps) {
  const [pivotCatalogsJson, setPivotCatalogsJson] = useState<string>(() =>
    JSON.stringify(pivotCatalogs ?? DEFAULT_PIVOT_CATALOGS, null, 2)
  );
  const [isPending, startTransition] = useTransition();
  const [savedPivots, setSavedPivots] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  function savePivotCatalogs() {
    let parsed: PivotCatalogs;
    try {
      parsed = JSON.parse(pivotCatalogsJson) as PivotCatalogs;
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
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
      {/* Pivot catalogs */}
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
        {jsonError && (
          <p className="mb-2 font-mono text-[11px] text-red-400">JSON error: {jsonError}</p>
        )}
        <button
          onClick={savePivotCatalogs}
          disabled={isPending}
          className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : savedPivots ? "✓ Saved" : "Save pivot catalogs"}
        </button>
      </section>

      {/* Pivots reference */}
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
    </div>
  );
}
