"use client";

const CATEGORY_COLORS: Record<string, string> = {
  Finance: "#00AB76",
  Technology: "#067BC2",
  Energy: "#dc6a3f",
  Culture: "#C2C6A2",
  "Food & Health": "#663300",
};

interface StatsBarProps {
  total: number;
  published: number;
  pending: number;
  categoryCounts: Record<string, number>;
}

export default function StatsBar({ total, published, pending, categoryCounts }: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
      <div className="flex gap-3">
        <StatCard label="Total" value={total} />
        <StatCard label="Published" value={published} />
        <StatCard label="Pending" value={pending} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryCounts).map(([cat, count]) => (
          <span
            key={cat}
            className="rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium"
            style={{
              backgroundColor: `${CATEGORY_COLORS[cat] ?? "#555"}20`,
              color: CATEGORY_COLORS[cat] ?? "#888",
              border: `1px solid ${CATEGORY_COLORS[cat] ?? "#555"}40`,
            }}
          >
            {cat} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-[90px] flex-col rounded-lg border border-[#1a1b22] bg-[#0d0e13] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#3b3d4a]">
        {label}
      </span>
      <span className="font-mono text-xl font-bold text-white">{value}</span>
    </div>
  );
}
