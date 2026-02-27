"use client";

const STEPS = [
  {
    step: 1,
    title: "Get candidate image(s)",
    detail: "If the RSS item has a stock image URL, download it. Otherwise: Google Custom Search (image) by article title → download up to 5 candidate images.",
  },
  {
    step: 2,
    title: "AI image selection",
    detail: "GPT-4o receives the candidate image(s), article title, category, and brand hex color. It picks the single best image and returns: selectedIndex, reason, subjectDescription, colorTarget. Uses the Image selection prompts and pivot catalogs (composition, framing, camera) from the Prompts / Pivots config.",
  },
  {
    step: 3,
    title: "Build edit prompt",
    detail: "If a Direct edit template is set (Prompts tab): replace {{subjectDescription}}, {{reason}}, {{colorTarget}}, {{hexColor}}, {{headline}} and use that string. Otherwise: an LLM generates a short edit prompt from the Image edit system/user prompts.",
  },
  {
    step: 4,
    title: "Edit image (OpenAI)",
    detail: "OpenAI images/edits API (model: gpt-image-1): send the selected image and the edit prompt. Returns a new image (1536×1024). Selective colour and editorial style are applied per the prompt.",
  },
  {
    step: 5,
    title: "Resize & output",
    detail: "Convert to WebP and generate a filename from the article headline. The result is passed to the pipeline for WordPress upload.",
  },
];

export default function ImageGenerationFlow() {
  return (
    <div className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] p-4">
      <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a]">
        Image generation flow
      </h2>
      <p className="mb-4 font-mono text-[11px] text-[#3b3d4a]">
        Per-article flow for creating the editorial image. Prompts and pivot catalogs are configured under Prompts and Pivots &amp; Categories.
      </p>
      <ol className="space-y-4">
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
      <div className="mt-4 flex items-center gap-2 border-t border-[#1a1b22] pt-3">
        <span className="font-mono text-[10px] text-[#3b3d4a]">Branch:</span>
        <span className="font-mono text-[10px] text-[#6b6d7a]">
          Stock image available → use 1 candidate; else → Google search → up to 5 candidates. Same selection + edit + resize after that.
        </span>
      </div>
    </div>
  );
}
