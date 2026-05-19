import type { Agent } from "@/db/schema";

type Props = {
  agents: Agent[];
  categories: string[];
  rows: { agentId: string; values: { category: string; rate: number }[] }[];
};

const MAX = 0.5;
const TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export function FpAnalysis({ agents, categories, rows }: Props) {
  if (categories.length === 0 || rows.length === 0) return null;
  const byId = new Map(agents.map((a) => [a.id, a]));

  // Index per-agent rates by category for fast lookup
  const ratesByAgent = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const map = new Map<string, number>();
    for (const v of r.values) map.set(v.category, v.rate);
    ratesByAgent.set(r.agentId, map);
  }

  // Sort agents by their mean FP rate (best — lowest — first)
  const agentMeans = rows
    .map((r) => {
      const vals = categories
        .map((c) => ratesByAgent.get(r.agentId)?.get(c))
        .filter((v): v is number => typeof v === "number");
      const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      return { agentId: r.agentId, mean };
    })
    .sort((a, b) => a.mean - b.mean);

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">False positives</div>
            <h2>FP rate on hardened decoys</h2>
            <p className="lede">
              Lower is better. Each row is one agent; bars within a row are the
              {" "}{categories.length} negative categories. Hover for the category name.
            </p>
          </div>
        </div>

        <div className="chart-card">
          <div className="fp-axis">
            <div />
            <div className="axis-ticks">
              {TICKS.map((v) => (
                <span key={v} style={{ left: `${(v / MAX) * 100}%` }}>
                  {v.toFixed(1)}
                </span>
              ))}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--mute)", textAlign: "right" }}>
              mean
            </div>
          </div>
          <div>
            {agentMeans.map(({ agentId, mean }, ai) => {
              const a = byId.get(agentId);
              const color = a?.color ?? "#888";
              const ratesMap = ratesByAgent.get(agentId) ?? new Map();
              return (
                <div className="fp-row" key={agentId}>
                  <div className="fp-cat">
                    <span className="ix">{String(ai + 1).padStart(2, "0")}</span>
                    <span className="agent-swatch" style={{ background: color, marginRight: 6 }} />
                    <span className="agent-name">{agentId}</span>
                  </div>
                  <div className="fp-track">
                    {TICKS.map((v) => (
                      <span key={v} className="gridv" style={{ left: `${(v / MAX) * 100}%` }} />
                    ))}
                    {categories.map((cat, ci) => {
                      const rate = ratesMap.get(cat);
                      if (typeof rate !== "number") return null;
                      const top = (ci / categories.length) * 22;
                      const h = 22 / categories.length - 0.5;
                      const w = (rate / MAX) * 100;
                      // Subtle opacity gradient across categories so individual
                      // bars are still distinguishable within an all-same-color row.
                      const op = 0.55 + (ci / Math.max(1, categories.length - 1)) * 0.45;
                      return (
                        <span
                          key={cat}
                          className="fp-bar"
                          title={`${cat} — ${rate.toFixed(2)}`}
                          style={{
                            left: 0,
                            top: `${top + 0.25}px`,
                            height: `${h}px`,
                            width: `${w}%`,
                            background: color,
                            opacity: op,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="fp-mean">{mean.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
