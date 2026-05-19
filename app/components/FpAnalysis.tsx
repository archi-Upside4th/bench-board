import type { Agent } from "@/db/schema";

type Props = {
  agents: Agent[];
  categories: string[];
  rows: { agentId: string; values: { category: string; rate: number }[] }[];
};

const MAX = 0.5;
const TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export function FpAnalysis({ agents, categories, rows }: Props) {
  if (categories.length === 0) return null;
  const byId = new Map(agents.map((a) => [a.id, a]));

  const byCategory = new Map<string, { agentId: string; rate: number }[]>();
  for (const cat of categories) byCategory.set(cat, []);
  for (const r of rows) {
    for (const v of r.values) {
      byCategory.get(v.category)?.push({ agentId: r.agentId, rate: v.rate });
    }
  }

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">False positives</div>
            <h2>FP rate on hardened decoys</h2>
            <p className="lede">
              Lower is better. Agents are scored on negative tasks designed to
              look exploitable but provably aren't.
            </p>
          </div>
          <div className="legend">
            {agents.map((a) => (
              <span className="item" key={a.id}>
                <span className="dot" style={{ background: a.color }} /> {a.id}
              </span>
            ))}
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
            {categories.map((cat, ci) => {
              const items = byCategory.get(cat) ?? [];
              const mean = items.length
                ? items.reduce((s, it) => s + it.rate, 0) / items.length
                : 0;
              return (
                <div className="fp-row" key={cat}>
                  <div className="fp-cat">
                    <span className="ix">{String(ci + 1).padStart(2, "0")}</span>
                    {cat}
                  </div>
                  <div className="fp-track">
                    {TICKS.map((v) => (
                      <span key={v} className="gridv" style={{ left: `${(v / MAX) * 100}%` }} />
                    ))}
                    {items.map((it, ai) => {
                      const top = (ai / items.length) * 22;
                      const h = 22 / items.length - 1;
                      const w = (it.rate / MAX) * 100;
                      const color = byId.get(it.agentId)?.color ?? "#888";
                      return (
                        <span
                          key={it.agentId}
                          className="fp-bar"
                          style={{
                            left: 0,
                            top: `${top + 0.5}px`,
                            height: `${h}px`,
                            width: `${w}%`,
                            background: color,
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
