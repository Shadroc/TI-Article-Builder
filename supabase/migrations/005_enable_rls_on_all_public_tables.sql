-- Enable Row Level Security on all public tables.
-- Service role (used by the app) bypasses RLS; anon/authenticated roles
-- will have no access since we add no permissive policies.
-- This locks down direct API access via anon key.

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rss_feed_mt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_articles_markettactic ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_config ENABLE ROW LEVEL SECURITY;
