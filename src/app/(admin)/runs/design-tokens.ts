/** Shared design tokens — single source of truth for colors, status maps, and category palette. */

/** Surface colors — background layers from deepest to lightest */
export const SURFACE = {
  base: "#0a0b0f",       // page background
  terminal: "#050507",   // terminal panel background
  card: "#0d0e13",       // cards, modals, panels
  hover: "#111218",      // hover state on rows/buttons
  border: "#1a1b22",     // all borders and dividers
} as const;

/** Text color hierarchy — brightest to dimmest */
export const TEXT = {
  primary: "text-white",
  secondary: "text-[#8b8d9a]",
  muted: "text-[#6b6d7a]",
  disabled: "text-[#3b3d4a]",
} as const;

/** Font size scale — monospace throughout */
export const FONT_SIZE = {
  label: "text-[10px]",   // uppercase labels, metadata
  log: "text-[11px]",     // terminal log entries
  body: "text-xs",        // body text, buttons
  heading: "text-sm",     // section headings
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#00AB76",
  Technology: "#067BC2",
  Energy: "#dc6a3f",
  Culture: "#C2C6A2",
  "Food & Health": "#663300",
};

export const STATUS_COLORS = {
  idle: { border: "border-[#1a1b22]", bg: "bg-[#0d0e13]", text: "text-[#3b3d4a]", dot: "bg-[#3b3d4a]" },
  active: { border: "border-blue-500/60", bg: "bg-blue-500/5", text: "text-blue-400", dot: "bg-blue-500" },
  completed: { border: "border-emerald-500/30", bg: "bg-emerald-500/5", text: "text-emerald-400", dot: "bg-emerald-500" },
  error: { border: "border-red-500/40", bg: "bg-red-500/5", text: "text-red-400", dot: "bg-red-500" },
} as const;

/** Category badge styling helper */
export function categoryStyle(category: string) {
  const color = CATEGORY_COLORS[category] ?? "#555";
  return {
    backgroundColor: `${color}20`,
    color: CATEGORY_COLORS[category] ?? "#888",
    border: `1px solid ${color}40`,
  };
}
