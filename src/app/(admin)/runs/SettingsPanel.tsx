"use client";

import { useState } from "react";
import ConfigurationTab from "./ConfigurationTab";
import PromptsTab from "./PromptsTab";
import ImageGenerationFlow from "./ImageGenerationFlow";
import CategoriesTab from "./CategoriesTab";
import PivotsTab from "./PivotsCategoriesTab";
import { PipelineConfig } from "@/integrations/supabase";

type SettingsSection = "config" | "prompts" | "categories" | "pivots";

interface SiteWithCategories {
  id: string;
  name: string;
  slug: string;
  category_map?: Record<string, { id: number; color: string }> | null;
}

interface SettingsPanelProps {
  config: PipelineConfig | null;
  sites: SiteWithCategories[];
  onSaved: () => void;
}

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "config", label: "Configuration" },
  { key: "prompts", label: "Prompts" },
  { key: "categories", label: "Categories" },
  { key: "pivots", label: "Pivots" },
];

export default function SettingsPanel({ config, sites, onSaved }: SettingsPanelProps) {
  const [active, setActive] = useState<SettingsSection>("config");

  return (
    <div className="flex min-h-[500px] flex-col sm:flex-row">
      {/* Settings nav — horizontal tabs on mobile, sidebar on desktop */}
      <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#1a1b22] sm:w-[180px] sm:flex-col sm:gap-0 sm:overflow-visible sm:border-b-0 sm:border-r sm:pt-3">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 font-mono text-xs transition ${
              active === s.key
                ? "border-b-2 border-blue-500 bg-blue-500/5 text-white sm:border-b-0 sm:border-r-2"
                : "text-[#6b6d7a] hover:bg-[#111218] hover:text-[#8b8d9a]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto">
        {active === "config" && (
          <ConfigurationTab config={config} sites={sites} onSaved={onSaved} />
        )}
        {active === "prompts" && (
          <div className="flex flex-col gap-4 p-4">
            <ImageGenerationFlow />
            <PromptsTab editorPrompts={config?.editor_prompts ?? undefined} onSaved={onSaved} />
          </div>
        )}
        {active === "categories" && (
          <CategoriesTab
            globalCategoryMap={config?.category_map ?? undefined}
            sites={sites}
            onSaved={onSaved}
          />
        )}
        {active === "pivots" && (
          <PivotsTab pivotCatalogs={config?.pivot_catalogs ?? undefined} />
        )}
      </div>
    </div>
  );
}
