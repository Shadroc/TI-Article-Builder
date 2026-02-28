"use client";

const STEPS = [
  {
    step: 1,
    title: "Source image priority (3-tier chain)",
    detail:
      "Priority 1 — scrape the publisher's og:image (or twitter:image meta tag) directly from rssItem.link. If that fails or returns nothing, Priority 2 — download rssItem.img_url from StockNewsAPI. If that also fails, Priority 3 — fall back to Google CSE image search. The source that succeeds is recorded as imageSource ('og:image' | 'img_url' | 'google_cse') and its URL stored as sourceImageUrl, both persisted to ai_articles for display in the preview UI.",
  },
  {
    step: 2,
    title: "Prepare candidates",
    detail:
      "og:image and img_url paths produce a single candidate. Google CSE path queries for up to 5 large editorial photos, downloads each via item.link (the direct image URL), and discards any that fail. All candidates are held as raw Buffers + mimeType — no URLs are sent to the AI at this stage.",
  },
  {
    step: 3,
    title: "AI image selection — gpt-4o vision",
    detail:
      "Candidates are base64-encoded into data URIs and sent to gpt-4o with detail:\"auto\". The system message is image_selection_system (editable here) + formatted pivot catalogs. The user message is image_selection_user (editable here) with these placeholders filled: {{articleTitle}}, {{category}}, {{imageCount}}, {{imageCountMax}}, {{colorHint}}. The colorHint injects the category brand hex and instructs GPT to pick a specific, prominent NON-HUMAN physical object as the colorTarget — backgrounds, skies, walls, and all human elements (skin, hair, faces) are explicitly forbidden. GPT responds with JSON: { selectedIndex, reason, subjectDescription, colorTarget }.",
  },
  {
    step: 4,
    title: "Build the selective-colour edit prompt",
    detail:
      "Uses image_edit_direct_template from the database when saved; otherwise falls back to the built-in N8N_EDIT_DIRECT_TEMPLATE. Five placeholders are replaced: {{subjectDescription}} (what's in the image, max 15 words), {{reason}} (why it was selected, max 20 words), {{colorTarget}} (the specific object to colour, max 10 words — must be a named physical non-human object), {{hexColor}} (the category brand hex, e.g. #067BC2 for Technology), {{headline}} (article headline). The template leads with the CRITICAL RULE: render the entire image in black and white first, then apply {{hexColor}} to ONLY {{colorTarget}}. Every other element — background, sky, people, clothing, hair — stays black and white.",
  },
  {
    step: 5,
    title: "Edit image — gpt-image-1 (images/edits API)",
    detail:
      "The selected candidate buffer and filled prompt are posted to POST /v1/images/edits as multipart FormData: model=gpt-image-1, size=1536x1024, quality=high, n=1. The image is sent as a Blob with the correct MIME type (image/jpeg or image/png). A 3-minute AbortController timeout is applied. The API returns a b64_json string which is decoded to a Buffer.",
  },
  {
    step: 6,
    title: "Resize & convert to WebP",
    detail:
      "The raw edited buffer is passed through sharp: resized to 900×600, converted to WebP at quality 80. The filename is a URL-safe slug of the article headline + Unix timestamp + .webp.",
  },
  {
    step: 7,
    title: "Return & persist",
    detail:
      "processArticleImage returns ProcessedImage: { buffer, mimeType: 'image/webp', fileName, imageSource, sourceImageUrl }. The orchestrator passes imageSource and sourceImageUrl into saveAiArticle, which writes both to ai_articles.image_source and ai_articles.source_image_url. The ArticlePreview tab reads source_image_url as the 'Original' thumbnail and image_source as the coloured source badge (green = og:image, yellow = StockNewsAPI, slate = Google CSE).",
  },
];

const PLACEHOLDERS = [
  { name: "{{subjectDescription}}", source: "gpt-4o selection result", description: "What the main subject of the source image is (max 15 words)." },
  { name: "{{reason}}", source: "gpt-4o selection result", description: "Why this image was selected for the article (max 20 words)." },
  { name: "{{colorTarget}}", source: "gpt-4o selection result", description: "The single specific non-human physical object to apply selective colour to (e.g. 'the stethoscope', 'the oil derrick'). Max 10 words." },
  { name: "{{hexColor}}", source: "article.categoryColor", description: "Brand accent hex for the article's category (Finance #00AB76, Technology #067BC2, Energy #dc6a3f, Culture #C2C6A2, Food & Health #663300)." },
  { name: "{{headline}}", source: "article.headline", description: "The article's headline, used for composition context." },
];

export default function ImageGenerationFlow() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Image generation flow
        </h2>
        <p className="mb-4 font-mono text-[11px] text-[#3b3d4a]">
          Full production flow used by <span className="text-[#6b6d7a]">process_image</span>. Prompts are edited in the sections below; pivot catalogs are edited under Pivots &amp; Categories.
        </p>
        <ol className="space-y-5">
          {STEPS.map(({ step, title, detail }) => (
            <li key={step} className="flex gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1a1b22] bg-[#050507] font-mono text-[10px] font-medium text-[#6b6d7a]">
                {step}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-mono text-xs font-medium text-[#c8c9d0]">{title}</h3>
                <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-[#6b6d7a]">
                  {detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Edit template placeholder reference */}
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Edit template placeholders
        </h2>
        <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
          These are replaced in <span className="text-[#6b6d7a]">image_edit_direct_template</span> before the prompt is sent to gpt-image-1.
        </p>
        <div className="space-y-2">
          {PLACEHOLDERS.map(({ name, source, description }) => (
            <div key={name} className="rounded border border-[#1a1b22] bg-[#050507] px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-medium text-blue-400">{name}</span>
                <span className="font-mono text-[9px] text-[#3b3d4a]">← {source}</span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-[#6b6d7a]">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Selective colour technique note */}
      <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
        <h2 className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
          Selective-colour technique
        </h2>
        <p className="font-mono text-[11px] leading-relaxed text-[#6b6d7a]">
          The output is a <span className="text-[#c8c9d0]">selective-colour editorial photograph</span>: the entire image is rendered in rich black and white, and then the brand accent colour is applied to one specific non-human physical object only (the <span className="text-[#c8c9d0]">colorTarget</span>). Human faces, skin, and hair are always kept in greyscale regardless of what colorTarget is. The critical rule is placed at the very top of the edit prompt so gpt-image-1 prioritises it above all other instructions.
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {[
            { category: "Finance", hex: "#00AB76" },
            { category: "Technology", hex: "#067BC2" },
            { category: "Energy", hex: "#dc6a3f" },
            { category: "Culture", hex: "#C2C6A2" },
            { category: "Food & Health", hex: "#663300" },
          ].map(({ category, hex }) => (
            <div key={category} className="flex flex-col items-center gap-1.5 rounded border border-[#1a1b22] bg-[#050507] p-2">
              <span
                className="h-4 w-8 rounded-sm"
                style={{ backgroundColor: hex }}
              />
              <span className="text-center font-mono text-[9px] text-[#6b6d7a]">{category}</span>
              <span className="font-mono text-[9px] text-[#3b3d4a]">{hex}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
