"use client";

import { useState, useMemo } from "react";
import ArticleQueue, { QueueItem } from "./ArticleQueue";

const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#00AB76",
  Technology: "#067BC2",
  Energy: "#dc6a3f",
  Culture: "#C2C6A2",
  "Food & Health": "#663300",
};

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Find saved article that best matches the queue item (by rss_feed_id first, then title). */
function findArticleForQueueItem(
  queueTitle: string,
  articles: Record<string, unknown>[],
  rssFeedId?: string
): Record<string, unknown> | undefined {
  if (rssFeedId) {
    const byRss = articles.find((a) => (a.rss_feed_id as string) === rssFeedId);
    if (byRss) return byRss;
  }

  const normalizedQueue = normalizeTitle(queueTitle);
  if (!normalizedQueue) return undefined;

  const exact = articles.find((a) => (a.title as string)?.trim() === queueTitle.trim());
  if (exact) return exact;

  const normalizedMatch = articles.find((a) => {
    const t = (a.title as string)?.trim();
    if (!t) return false;
    return normalizeTitle(t) === normalizedQueue;
  });
  if (normalizedMatch) return normalizedMatch;

  const containsMatch = articles.find((a) => {
    const t = (a.title as string)?.trim();
    if (!t) return false;
    const n = normalizeTitle(t);
    return n.includes(normalizedQueue) || normalizedQueue.includes(n);
  });
  return containsMatch;
}

interface ArticlePreviewTabProps {
  items: QueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  articles: Record<string, unknown>[];
}

export default function ArticlePreviewTab({
  items,
  selectedId,
  onSelect,
  articles,
}: ArticlePreviewTabProps) {
  const selectedItem = items.find((i) => i.id === selectedId);
  const selected = useMemo(
    () =>
      selectedItem
        ? findArticleForQueueItem(selectedItem.title, articles, selectedItem.rssFeedId)
        : undefined,
    [selectedItem, articles]
  );

  return (
    <div className="flex h-[600px]">
      <ArticleQueue items={items} selectedId={selectedId} onSelect={onSelect} />
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedItem ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-[#3b3d4a]">
            Select an article to preview
          </div>
        ) : !selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 font-mono text-xs text-[#3b3d4a]">
            <p>Preview will appear when this article is saved.</p>
            <p className="text-[10px]">({selectedItem.title})</p>
          </div>
        ) : (
          <ArticlePreview article={selected} />
        )}
      </div>
    </div>
  );
}

function ArticlePreview({ article }: { article: Record<string, unknown> }) {
  const [imageExpanded, setImageExpanded] = useState(false);
  const title = (article.title as string) ?? "Untitled";
  const content = (article.content as string) ?? "";
  const rss = article.rss_feed as Record<string, unknown> | null;
  const imageUrl = article.wp_image_url as string | null;
  const wpPostId = article.wp_post_id as number | null;

  const categoryMatch = content.match(/<strong>\s*Category:\s*<\/strong>\s*([^<]+)/i);
  const category = categoryMatch ? categoryMatch[1].trim() : "Uncategorized";
  const tagsMatch = content.match(/<strong>\s*Tags:\s*<\/strong>\s*([^<]+)/i);
  const tags = tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-4">
      {/* Top row: category + image thumbnail */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium"
            style={{
              backgroundColor: `${CATEGORY_COLORS[category] ?? "#555"}20`,
              color: CATEGORY_COLORS[category] ?? "#888",
              border: `1px solid ${CATEGORY_COLORS[category] ?? "#555"}40`,
            }}
          >
            {category}
          </span>
          {wpPostId && (
            <span className="font-mono text-[10px] text-[#3b3d4a]">
              WP #{wpPostId}
            </span>
          )}
        </div>

        {/* Image thumbnail */}
        {imageUrl ? (
          <button
            onClick={() => setImageExpanded(true)}
            className="group relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-[#1a1b22] bg-[#0d0e13] transition hover:border-blue-500/40"
            title="Click to view full image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
              <span className="font-mono text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                View
              </span>
            </div>
          </button>
        ) : (
          <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-[#1a1b22] bg-[#0d0e13]">
            <span className="font-mono text-[9px] text-[#3b3d4a]">No image</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-[#1a1b22] bg-[#0d0e13] px-2 py-0.5 font-mono text-[9px] text-[#6b6d7a]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Headline */}
      <h1 className="font-serif text-xl leading-snug text-white">{title}</h1>

      {/* SEO metadata */}
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
          SEO Metadata
        </div>
        <div className="space-y-1.5">
          <div>
            <span className="font-mono text-[10px] text-[#3b3d4a]">Meta Title: </span>
            <span className="font-mono text-xs text-[#8b8d9a]">{title}</span>
          </div>
          {imageUrl && (
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Featured Image: </span>
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-blue-400 hover:underline"
              >
                {imageUrl}
              </a>
            </div>
          )}
          {rss && (
            <div>
              <span className="font-mono text-[10px] text-[#3b3d4a]">Source: </span>
              <a
                href={rss.link as string}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-blue-400 hover:underline"
              >
                {rss.link as string}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Rendered article */}
      <div
        className="prose prose-invert prose-sm max-w-none font-serif text-[#c8c9d0] prose-headings:font-serif prose-headings:text-white prose-a:text-blue-400 prose-strong:text-white prose-blockquote:border-blue-500/40 prose-blockquote:text-[#8b8d9a]"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Lightbox */}
      {imageExpanded && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setImageExpanded(false)}
        >
          <div
            className="relative max-h-full max-w-5xl overflow-hidden rounded-xl border border-[#1a1b22]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={title}
              className="max-h-[85vh] w-auto object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
              <p className="font-serif text-sm text-white/80">{title}</p>
            </div>
            <button
              onClick={() => setImageExpanded(false)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 font-mono text-xs text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>
          <p className="absolute bottom-4 font-mono text-[10px] text-white/30">
            Click outside to close
          </p>
        </div>
      )}
    </div>
  );
}
