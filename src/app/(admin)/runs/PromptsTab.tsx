"use client";

import { useState, useTransition } from "react";
import { EditorPrompts } from "@/integrations/supabase";
import { updateEditorConfig } from "./actions";
import { DEFAULT_PROMPTS, N8N_EDIT_DIRECT_TEMPLATE } from "@/lib/default-editor-prompts";

type SectionKey = "article" | "image_selection" | "image_edit";

interface PromptsTabProps {
  editorPrompts: EditorPrompts | null | undefined;
}

export default function PromptsTab({ editorPrompts }: PromptsTabProps) {
  const [prompts, setPrompts] = useState<EditorPrompts>(() => ({
    ...DEFAULT_PROMPTS,
    ...(editorPrompts ?? {}),
  }));
  const [openSection, setOpenSection] = useState<SectionKey | null>("image_edit");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(section: SectionKey) {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  function savePrompts() {
    startTransition(async () => {
      const res = await updateEditorConfig({ editor_prompts: prompts });
      if (!res.error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-[11px] text-[#3b3d4a]">
          Expand a section to edit. Placeholders are replaced at runtime.
        </p>
        <button
          onClick={savePrompts}
          disabled={isPending}
          className="rounded bg-[#1a1b22] px-4 py-2 font-mono text-xs text-[#8b8d9a] transition hover:bg-[#22232d] hover:text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : saved ? "✓ Saved" : "Save prompts"}
        </button>
      </div>

      {/* Article writing */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] overflow-hidden">
        <button
          type="button"
          onClick={() => toggle("article")}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a] hover:bg-[#14151a]"
        >
          Article writing
          <span className="text-[#3b3d4a]">{openSection === "article" ? "▼" : "▶"}</span>
        </button>
        {openSection === "article" && (
          <div className="border-t border-[#1a1b22] p-4">
            <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
              Placeholders: <code className="text-blue-400">{`{{rssTitle}}`}</code>,{" "}
              <code className="text-blue-400">{`{{contentSnippet}}`}</code>,{" "}
              <code className="text-blue-400">{`{{googleSearchContent}}`}</code>,{" "}
              <code className="text-blue-400">{`{{pubDate}}`}</code>
            </p>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">System message</label>
                <textarea
                  value={prompts.article_writing_system}
                  onChange={(e) => setPrompts((p) => ({ ...p, article_writing_system: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">User prompt template</label>
                <textarea
                  value={prompts.article_writing_user}
                  onChange={(e) => setPrompts((p) => ({ ...p, article_writing_user: e.target.value }))}
                  rows={28}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs leading-relaxed text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Image selection */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] overflow-hidden">
        <button
          type="button"
          onClick={() => toggle("image_selection")}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a] hover:bg-[#14151a]"
        >
          Image selection (AI Agent)
          <span className="text-[#3b3d4a]">{openSection === "image_selection" ? "▼" : "▶"}</span>
        </button>
        {openSection === "image_selection" && (
          <div className="border-t border-[#1a1b22] p-4">
            <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
              Placeholders: <code className="text-blue-400">{`{{articleTitle}}`}</code>,{" "}
              <code className="text-blue-400">{`{{category}}`}</code>,{" "}
              <code className="text-blue-400">{`{{colorHint}}`}</code>,{" "}
              <code className="text-blue-400">{`{{imageCount}}`}</code>,{" "}
              <code className="text-blue-400">{`{{imageCountMax}}`}</code>
            </p>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">System message</label>
                <textarea
                  value={prompts.image_selection_system}
                  onChange={(e) => setPrompts((p) => ({ ...p, image_selection_system: e.target.value }))}
                  rows={2}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">User prompt template</label>
                <textarea
                  value={prompts.image_selection_user}
                  onChange={(e) => setPrompts((p) => ({ ...p, image_selection_user: e.target.value }))}
                  rows={18}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Image edit */}
      <section className="rounded-lg border border-[#1a1b22] bg-[#0d0e13] overflow-hidden">
        <button
          type="button"
          onClick={() => toggle("image_edit")}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wider text-[#6b6d7a] hover:bg-[#14151a]"
        >
          Image edit prompt generator
          <span className="text-[#3b3d4a]">{openSection === "image_edit" ? "▼" : "▶"}</span>
        </button>
        {openSection === "image_edit" && (
          <div className="border-t border-[#1a1b22] p-4">
            <p className="mb-3 font-mono text-[11px] text-[#3b3d4a]">
              When <strong>Direct edit template</strong> is set, it is sent to the image API after replacing placeholders (no LLM). When empty, the System/User prompts below are used to generate a prompt via LLM.
            </p>
            <div className="mb-4">
              <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">Direct edit template (sent to API)</label>
              <textarea
                value={prompts.image_edit_direct_template ?? N8N_EDIT_DIRECT_TEMPLATE}
                onChange={(e) => setPrompts((p) => ({ ...p, image_edit_direct_template: e.target.value || null }))}
                rows={22}
                placeholder="Leave empty to use LLM-generated prompt from System/User below."
                className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs leading-relaxed text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 font-mono text-[10px] text-[#3b3d4a]">
                Placeholders: <code className="text-blue-400">{`{{subjectDescription}}`}</code>,{" "}
                <code className="text-blue-400">{`{{reason}}`}</code>,{" "}
                <code className="text-blue-400">{`{{colorTarget}}`}</code>,{" "}
                <code className="text-blue-400">{`{{hexColor}}`}</code>,{" "}
                <code className="text-blue-400">{`{{headline}}`}</code>
              </p>
            </div>
            <p className="mb-2 font-mono text-[10px] text-[#3b3d4a]">Fallback (when direct template is empty):</p>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">System message</label>
                <textarea
                  value={prompts.image_edit_system}
                  onChange={(e) => setPrompts((p) => ({ ...p, image_edit_system: e.target.value }))}
                  rows={10}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] text-[#3b3d4a]">User prompt template</label>
                <textarea
                  value={prompts.image_edit_user}
                  onChange={(e) => setPrompts((p) => ({ ...p, image_edit_user: e.target.value }))}
                  rows={6}
                  className="w-full rounded border border-[#1a1b22] bg-[#050507] px-3 py-2 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
