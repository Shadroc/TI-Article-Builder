import { supabase, EditorPrompts, CategoryMap, PivotCatalogs } from "@/integrations/supabase";
import { DEFAULT_PIVOT_CATALOGS, formatPivotCatalogsForAI } from "./default-pivot-catalogs";

const DEFAULT_CATEGORY_MAP: CategoryMap = {
  Finance: { id: 7, color: "#00AB76" },
  Technology: { id: 6, color: "#067BC2" },
  Energy: { id: 5, color: "#dc6a3f" },
  Culture: { id: 1, color: "#C2C6A2" },
  "Food & Health": { id: 4, color: "#663300" },
};

export interface EditorConfig {
  editor_prompts: EditorPrompts | null;
  category_map: CategoryMap | null;
  pivot_catalogs: PivotCatalogs | null;
}

const EDITOR_CONFIG_CACHE_MS = 30_000; // 30s - reduces repeated fetches during pipeline run
let cachedConfig: EditorConfig | null = null;
let cacheExpiry = 0;

export async function getEditorConfig(): Promise<EditorConfig> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  const { data } = await supabase()
    .from("pipeline_config")
    .select("editor_prompts, category_map, pivot_catalogs")
    .limit(1)
    .single();

  cachedConfig = {
    editor_prompts: (data?.editor_prompts as EditorPrompts) ?? null,
    category_map: (data?.category_map as CategoryMap) ?? null,
    pivot_catalogs: (data?.pivot_catalogs as PivotCatalogs) ?? null,
  };
  cacheExpiry = Date.now() + EDITOR_CONFIG_CACHE_MS;
  return cachedConfig;
}

export function getCategoryMap(): CategoryMap {
  return DEFAULT_CATEGORY_MAP;
}

export async function getCategoryMapFromConfig(): Promise<CategoryMap> {
  const { category_map } = await getEditorConfig();
  if (category_map && Object.keys(category_map).length > 0) return category_map;
  return DEFAULT_CATEGORY_MAP;
}

export { formatPivotCatalogsForAI, DEFAULT_PIVOT_CATALOGS };
