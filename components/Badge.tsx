import type { AgentStatus } from "@/lib/types";

const STATUS_LABEL: Record<AgentStatus, string> = {
  live: "LIVE",
  vetting: "VETTING",
  paused: "PAUSED",
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--positive)]/30 bg-[var(--positive)]/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-[var(--positive)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
        {STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
      style={{
        borderColor: "var(--border-strong)",
        background: "var(--card-solid)",
        color: "var(--muted)",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function MarketChip({ market }: { market: string }) {
  return (
    <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
      {market}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <span
      className={`tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
        isTop3 ? "" : "text-[var(--muted)]"
      }`}
      style={{
        background: isTop3 ? "var(--grad-accent)" : "var(--card-solid)",
        color: isTop3 ? "var(--on-accent)" : undefined,
        border: isTop3 ? "none" : "1px solid var(--border)",
      }}
    >
      {rank}
    </span>
  );
}
