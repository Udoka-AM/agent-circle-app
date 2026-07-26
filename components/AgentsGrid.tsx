"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Agent, MarketCategory } from "@/lib/types";
import { AgentAvatar } from "@/components/AgentAvatar";
import { StatusBadge, MarketChip } from "@/components/Badge";
import { Sparkline } from "@/components/Sparkline";

const MARKETS: (MarketCategory | "All")[] = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Macro",
  "Event Markets",
];

type SortKey = "score" | "return" | "winRate";

export function AgentsGrid({ agents }: { agents: Agent[] }) {
  const [market, setMarket] = useState<(typeof MARKETS)[number]>("All");
  const [sort, setSort] = useState<SortKey>("score");

  const filtered = useMemo(() => {
    const base = market === "All" ? agents : agents.filter((a) => a.market === market);
    return [...base].sort((a, b) => {
      if (sort === "score") return b.agentScore - a.agentScore;
      if (sort === "return") return b.totalReturn - a.totalReturn;
      return b.winRate - a.winRate;
    });
  }, [agents, market, sort]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by market">
          {MARKETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMarket(m)}
              aria-pressed={market === m}
              className={`chip ${market === m ? "chip-selected" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border bg-transparent px-3 py-2 text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="score">Agent Score</option>
            <option value="return">Total Return</option>
            <option value="winRate">Win Rate</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border px-5 py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted)" }}
        >
          No agents in this market yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.slug}`}
              className="group hover-lift flex flex-col gap-4 rounded-2xl border p-6"
              style={{
                borderColor: agent.rank === 1 ? "transparent" : "var(--border)",
                background: "var(--card)",
                ...(agent.rank === 1
                  ? {
                      backgroundImage:
                        "linear-gradient(var(--card), var(--card)), var(--grad-accent)",
                      backgroundOrigin: "border-box",
                      backgroundClip: "padding-box, border-box",
                      border: "1px solid transparent",
                    }
                  : {}),
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AgentAvatar name={agent.name} size={44} ring={agent.rank <= 3 && agent.rank > 0} />
                  <div>
                    <div className="text-sm font-semibold">{agent.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {agent.builder.name}
                    </div>
                  </div>
                </div>
                <StatusBadge status={agent.status} />
              </div>

              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {agent.description}
              </p>

              <div className="flex items-center justify-between">
                <MarketChip market={agent.market} />
                {agent.status === "live" && <Sparkline data={agent.history} width={72} height={28} />}
              </div>

              {agent.status === "live" ? (
                <div className="grid grid-cols-3 gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <div className="tabular text-sm font-semibold">{agent.agentScore.toFixed(1)}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      Score
                    </div>
                  </div>
                  <div>
                    <div className="tabular text-sm font-semibold" style={{ color: "var(--positive)" }}>
                      +{agent.totalReturn}%
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      Return
                    </div>
                  </div>
                  <div>
                    <div className="tabular text-sm font-semibold" style={{ color: "var(--negative)" }}>
                      {agent.maxDrawdown}%
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      Drawdown
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  Performance record unlocks once vetting completes.
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
