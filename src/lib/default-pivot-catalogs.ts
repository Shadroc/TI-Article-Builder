import type { PivotCatalogs } from "@/integrations/supabase";

/**
 * Default from n8n "Framing - Pivot -" node.
 * Used when pipeline_config.pivot_catalogs is null.
 */
export const DEFAULT_PIVOT_CATALOGS: PivotCatalogs = {
  composition_catalog: {
    blueprints: [
      { name: "Wide Establishing Shot", tags: ["location", "context", "branding"], usage: "Introduce location or organization with visual authority.", traits: "Full building or site, angled upward, includes logo or signage.", ai_guidance: "Include sky or ground for context; avoid visual clutter.", example: "A corporate HQ building framed with sky, logo visible near entrance." },
      { name: "Foreground Subject, Background Context", tags: ["subject", "environment", "depth"], usage: "Highlight a key person or object within a larger context.", traits: "Sharp foreground, blurred background with suggestive context.", ai_guidance: "Keep subject tight but don't isolate; hint at its role or environment.", example: "A clean energy device in front, solar field blurred behind." },
      { name: "Tight Hero Crop", tags: ["emotion", "portrait", "symbolism"], usage: "Emphasize personal or symbolic detail.", traits: "Close-up on face, hands, or critical object; soft or abstract background.", ai_guidance: "Use strong lighting and shallow depth of field.", example: "Close-up of a scientist's hands holding a glowing vial." },
      { name: "Rule-of-Thirds Product or Logo", tags: ["branding", "layout", "commercial"], usage: "Create visual balance for thumbnails or article cards.", traits: "Subject in one third of frame, with clean negative space.", ai_guidance: "Use clear background to contrast with product or logo.", example: "Electric truck in bottom-left third, vast road stretching into distance." },
      { name: "Diagonal Leading Lines", tags: ["movement", "depth", "direction"], usage: "Guide viewer's eye to a key visual point.", traits: "Lines (roads, desks, pipes) lead to subject or symbol.", ai_guidance: "Position subject at visual end of a strong line.", example: "Factory floor with conveyor leading toward branded shipping crate." },
      { name: "Symmetrical Head-On Composition", tags: ["formality", "balance", "power"], usage: "Imply authority, stability, or central focus.", traits: "Centered subject with mirrored or structured surroundings.", ai_guidance: "Make edges parallel and avoid off-kilter elements.", example: "Podium with national flag behind, speaker centered with balanced backdrop." },
      { name: "Silhouette with Backlight", tags: ["drama", "mystery", "symbolism"], usage: "Imply anonymity, scale, or intensity.", traits: "Subject in shadow, background glows brightly.", ai_guidance: "Keep subject unlit with strong backlight from sky or display.", example: "Silhouetted worker in front of glowing data center wall." },
      { name: "Macro / Micro Detail", tags: ["technology", "science", "precision"], usage: "Suggest innovation, detail, or fragility.", traits: "Extreme close-up on tool, material, or biological detail.", ai_guidance: "Focus on fine textures; ignore background context.", example: "Macro of needle drawing liquid from biotech vial." },
      { name: "Environmental Isolation", tags: ["loneliness", "scale", "tone"], usage: "Emphasize solitude, exposure, or focus.", traits: "Subject dwarfed by open space, minimal clutter.", ai_guidance: "Maximize contrast between subject size and environment.", example: "Person walking alone through snowy corporate plaza." },
    ],
  },
  framing_catalog: [
    { id: "eye-level-straight", tags: ["neutral", "direct", "human"], description: "Camera is at subject's eye level and parallel to the ground. Creates a straightforward, honest, and relatable feeling.", use_case: "Interviews, press photos, statements" },
    { id: "low-angle-up", tags: ["authority", "power", "monumental"], description: "Camera is below subject, looking up. Suggests power, dominance, or scale.", use_case: "CEOs, politicians, large buildings" },
    { id: "high-angle-down", tags: ["vulnerability", "overview", "scale"], description: "Camera is above subject, looking down. Makes subject feel smaller or shows broader scene.", use_case: "Crowds, crisis zones, warehouse scenes" },
    { id: "over-the-shoulder", tags: ["POV", "narrative", "dialogue"], description: "Camera looks over subject's shoulder. Suggests perspective or implied conversation.", use_case: "Tech demonstrations, courtroom scenes" },
    { id: "wide-distance", tags: ["context", "setting", "scale"], description: "Subject appears small in frame. Emphasizes environment or broader impact.", use_case: "Disaster zones, protests, large machinery" },
    { id: "tight-crop", tags: ["emotion", "intensity", "intimacy"], description: "Camera is zoomed in on subject's face or hands. Emphasizes emotion or detail.", use_case: "CEO reactions, scientific work, expressions" },
    { id: "overhead-drone", tags: ["drone", "top-down", "scale"], description: "Bird's-eye view looking straight down. Abstracts space and shows layout or crowd.", use_case: "Protests, traffic, agriculture, construction" },
  ],
  camera_catalog: [
    { id: "sony-a7r-iv", label: "Sony α7R IV", note: "high resolution, pro-grade sensor, commonly used in photojournalism" },
    { id: "canon-eos-r5", label: "Canon EOS R5", note: "full-frame mirrorless, reliable for fast-action or portrait editorial work" },
    { id: "leica-m10", label: "Leica M10", note: "used for candid street-style editorial, rich tones, softer edges" },
    { id: "nikon-d850", label: "Nikon D850", note: "versatile DSLR with deep color range and editorial realism" },
  ],
};

/** Build a string block to inject into the AI system message so the model can use composition, framing, and camera guidance. */
export function formatPivotCatalogsForAI(catalogs: PivotCatalogs | null | undefined): string {
  if (!catalogs) return "";

  const parts: string[] = [];

  if (catalogs.composition_catalog?.blueprints?.length) {
    const list = catalogs.composition_catalog.blueprints
      .map((b) => `- ${b.name}: ${b.usage} Traits: ${b.traits} AI guidance: ${b.ai_guidance}`)
      .join("\n");
    parts.push("COMPOSITION BLUEPRINTS (choose or blend for the editorial image):\n" + list);
  }

  if (catalogs.framing_catalog?.length) {
    const list = catalogs.framing_catalog
      .map((f) => `- ${f.id}: ${f.description} Use for: ${f.use_case}`)
      .join("\n");
    parts.push("FRAMING OPTIONS (camera angle/framing):\n" + list);
  }

  if (catalogs.camera_catalog?.length) {
    const list = catalogs.camera_catalog
      .map((c) => `- ${c.label}: ${c.note}`)
      .join("\n");
    parts.push("CAMERA / SENSOR STYLE (suggest visual fidelity):\n" + list);
  }

  if (parts.length === 0) return "";
  return "\n\nUse these pivots to guide composition, framing, and style when selecting the best image and when writing the image edit prompt:\n\n" + parts.join("\n\n");
}
