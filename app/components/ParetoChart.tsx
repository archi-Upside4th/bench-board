"use client";
import { useMemo } from "react";
import type { Agent, DetectResult } from "@/db/schema";

type Props = {
  agents: Agent[];
  detect: DetectResult[];
};

const W = 520;
const H = 320;
const PAD = { l: 56, r: 24, t: 24, b: 44 };
const X_MIN = 0.1;
const X_MAX = 10;
const Y_MIN = 0.4;
const Y_MAX = 0.9;

function logX(x: number) {
  const lo = Math.log10(X_MIN);
  const hi = Math.log10(X_MAX);
  const k = (Math.log10(x) - lo) / (hi - lo);
  return PAD.l + k * (W - PAD.l - PAD.r);
}

function yAt(y: number) {
  const k = (y - Y_MIN) / (Y_MAX - Y_MIN);
  return H - PAD.b - k * (H - PAD.t - PAD.b);
}

export function ParetoChart({ agents, detect }: Props) {
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const points = detect.map((d) => ({
    id: d.agentId,
    color: byId.get(d.agentId)?.color ?? "#888",
    x: d.costUsdPerTask,
    y: d.f1,
  }));

  const frontier = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const out: typeof points = [];
    let maxY = -Infinity;
    for (const p of sorted) {
      if (p.y > maxY) {
        out.push(p);
        maxY = p.y;
      }
    }
    return out;
  }, [points]);

  const xTicks = [0.1, 0.3, 1, 3, 10];
  const yTicks = [0.5, 0.6, 0.7, 0.8, 0.9];

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">Cost vs accuracy</div>
            <h2>Pareto frontier</h2>
            <p className="lede">
              Each point is one agent. Higher and to the left is better — strong
              detection F1 at low per-task cost.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <div className="chart-card">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img">
              {yTicks.map((y) => (
                <g key={y}>
                  <line
                    className="grid-line"
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={yAt(y)}
                    y2={yAt(y)}
                  />
                  <text className="tick-label" x={PAD.l - 8} y={yAt(y) + 3} textAnchor="end">
                    {y.toFixed(1)}
                  </text>
                </g>
              ))}
              {xTicks.map((x) => (
                <g key={x}>
                  <line
                    className="grid-line"
                    x1={logX(x)}
                    x2={logX(x)}
                    y1={PAD.t}
                    y2={H - PAD.b}
                  />
                  <text className="tick-label" x={logX(x)} y={H - PAD.b + 14} textAnchor="middle">
                    ${x}
                  </text>
                </g>
              ))}
              <text className="axis-label" x={W / 2} y={H - 8} textAnchor="middle">
                cost per task (USD, log scale)
              </text>
              <text
                className="axis-label"
                transform={`rotate(-90 12 ${H / 2})`}
                x={12}
                y={H / 2}
                textAnchor="middle"
              >
                F1 score
              </text>

              <polyline
                className="frontier"
                points={frontier.map((p) => `${logX(p.x)},${yAt(p.y)}`).join(" ")}
              />

              {points.map((p) => {
                const isFrontier = frontier.some((f) => f.id === p.id);
                return (
                  <g key={p.id}>
                    <circle
                      className="scatter-pt"
                      cx={logX(p.x)}
                      cy={yAt(p.y)}
                      r={6}
                      fill={isFrontier ? p.color : "var(--bg-card)"}
                      stroke={p.color}
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="commentary">
            <div className="quote">
              The frontier illustrates a clean cost–accuracy trade-off:
              <em> top-tier F1 doesn't require top-tier spend</em>.
            </div>
            <p>
              The lowest-cost frontier agent achieves competitive F1 at a fraction of the cost of the
              top model — a meaningful trade if budget-sensitive deployment matters.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
