import type { Agent } from "@/db/schema";

type Props = {
  agents: Agent[];
  categories: string[];
  rows: { agentId: string; values: { category: string; rate: number }[] }[];
};

const MAX = 0.5;
const TICKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

export function FpAnalysis({ agents, categories, rows }: Props) {
  if (rows.length === 0) return null;
  const byId = new Map(agents.map((a) => [a.id, a]));

  // Compute one mean per agent across all categories
  const agentMeans = rows
    .map((r) => {
      const vals = r.values.map((v) => v.rate);
      const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      return { agentId: r.agentId, mean };
    })
    .sort((a, b) => a.mean - b.mean); // best (lowest FP) first

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">False positives</div>
            <h2>FP rate on hardened decoys</h2>
            <p className="lede">
              Lower is better. Mean false-positive rate per agent across
              {" "}{categories.length} negative categories.
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
              const w = Math.min(100, (mean / MAX) * 100);
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
                    <span
                      className="fp-bar"
                      style={{
                        left: 0,
                        top: 2,
                        bottom: 2,
                        height: "auto",
                        width: `${w}%`,
                        background: color,
                        opacity: 0.9,
                      }}
                    />
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
