WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY rss_feed_id, site_id
      ORDER BY
        (wp_post_id IS NOT NULL) DESC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS row_num
  FROM public.ai_articles
  WHERE site_id IS NOT NULL
)
DELETE FROM public.ai_articles
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_articles_rss_feed_site_unique
  ON public.ai_articles (rss_feed_id, site_id)
  WHERE site_id IS NOT NULL;
