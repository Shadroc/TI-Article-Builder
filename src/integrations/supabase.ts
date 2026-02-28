import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(env().NEXT_PUBLIC_SUPABASE_URL, env().SUPABASE_SECRET_KEY);
  }
  return _client;
}

export interface RssFeedRow {
  id: string;
  title: string;
  link: string;
  pub_date: string;
  content: string;
  content_snippet?: string;
  img_url?: string;
  should_draft_article?: boolean;
  created_at?: string;
}

export interface SiteRow {
  id: string;
  name: string;
  slug: string;
  wp_base_url: string;
  active: boolean;
  category_map: Record<string, { id: number; color: string }>;
}

export interface AiArticleRow {
  id?: string;
  rss_feed_id: string;
  title: string;
  content: string;
  site_id: string;
  wp_post_id?: number;
  wp_media_id?: number;
  wp_image_url?: string;
  image_source?: string;
  source_image_url?: string;
  created_at?: string;
}

export interface WorkflowRun {
  id?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  trigger: "cron" | "manual";
  started_at?: string;
  finished_at?: string;
  article_count?: number;
  error?: string;
  cancel_requested_at?: string;
}

export interface PipelineConfig {
  id?: string;
  headlines_to_fetch: number;
  /** StockNews date: "today" | "yesterday" | "MMDDYYYY-MMDDYYYY" (custom range) */
  headlines_date?: string;
  publish_status: "draft" | "publish";
  target_sites: string[];
  writer_model: string;
  image_model: string;
  editor_prompts?: EditorPrompts | null;
  category_map?: CategoryMap | null;
  pivot_catalogs?: PivotCatalogs | null;
}

/** From n8n "Framing - Pivot -" node: composition blueprints, framing options, camera options. */
export interface PivotCatalogs {
  composition_catalog?: CompositionCatalog | null;
  framing_catalog?: FramingOption[] | null;
  camera_catalog?: CameraOption[] | null;
}

export interface CompositionBlueprint {
  name: string;
  tags: string[];
  usage: string;
  traits: string;
  ai_guidance: string;
  example: string;
}

export interface CompositionCatalog {
  blueprints: CompositionBlueprint[];
}

export interface FramingOption {
  id: string;
  tags: string[];
  description: string;
  use_case: string;
}

export interface CameraOption {
  id: string;
  label: string;
  note: string;
}

export interface EditorPrompts {
  article_writing_system: string;
  article_writing_user: string;
  image_selection_system: string;
  image_selection_user: string;
  /** Sent directly to OpenAI images/edits after replacing placeholders. Falls back to N8N_EDIT_DIRECT_TEMPLATE when empty. */
  image_edit_direct_template?: string | null;
}

export type CategoryMap = Record<string, { id: number; color: string }>;

export interface WorkflowStep {
  id?: string;
  run_id: string;
  article_index: number;
  step_name: string;
  status: "running" | "completed" | "failed" | "skipped";
  input_summary?: string;
  output_summary?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}
