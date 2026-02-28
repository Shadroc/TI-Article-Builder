-- 1) Repoint ai_articles to the canonical rss_feed row for duplicate links where site_id is NULL.
WITH ranked AS (
  SELECT
    id,
    link,
    ROW_NUMBER() OVER (PARTITION BY link ORDER BY id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY link ORDER BY id ASC) AS keep_id
  FROM public.rss_feed
  WHERE site_id IS NULL
    AND link IS NOT NULL
    AND link <> ''
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.ai_articles AS a
SET rss_feed_id = d.keep_id
FROM dupes AS d
WHERE a.rss_feed_id = d.id
  AND a.rss_feed_id <> d.keep_id;

-- 2) Delete duplicate rss_feed rows (keep the canonical smallest id per link).
DELETE FROM public.rss_feed AS r
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY link ORDER BY id ASC) AS rn
    FROM public.rss_feed
    WHERE site_id IS NULL
      AND link IS NOT NULL
      AND link <> ''
  ) AS ranked
  WHERE rn > 1
) AS to_delete
WHERE r.id = to_delete.id;

-- 3) Enforce uniqueness for link values when site_id is NULL (the path this pipeline writes).
CREATE UNIQUE INDEX IF NOT EXISTS rss_feed_link_unique_when_site_null
  ON public.rss_feed (link)
  WHERE site_id IS NULL
    AND link IS NOT NULL
    AND link <> '';
