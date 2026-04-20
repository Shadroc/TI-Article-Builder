-- The partial index from migration 010 cannot be inferred by Postgres for
-- ON CONFLICT without a matching WHERE predicate, which supabase-js does not
-- emit. site_id is declared NOT NULL on ai_articles, so the partial predicate
-- is redundant. Replace it with a full unique index so upsert({ onConflict })
-- works.

DROP INDEX IF EXISTS public.ai_articles_rss_feed_site_unique;

CREATE UNIQUE INDEX ai_articles_rss_feed_site_unique
  ON public.ai_articles (rss_feed_id, site_id);
