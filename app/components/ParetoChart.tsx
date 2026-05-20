"use client";
import { useMemo } from "react";
import type { Agent, DetectResult } from "@/db/schema";
import { renderInline } from "@/lib/inline";

type Props = {
  agents: Agent[];
  detect: DetectResult[];
  title: string;
  lede: string;
  quote: string;
  body: string;
};

const W = 520;
const H = 320;
const PAD = { l: 56, r: 24, t: 24, b: 44 };
const X_MIN = 100;
const X_MAX = 10000;
const Y_MIN = 0.4;
const Y_MAX = 0.9;

function logX(x: number) {
  const clamped = Math.max(X_MIN, Math.min(X_MAX, x));
  const lo = Math.log10(X_MIN);
  const hi = Math.log10(X_MAX);
  const k = (Math.log10(clamped) - lo) / (hi - lo);
  return PAD.l + k * (W - PAD.l - PAD.r);
}

function yAt(y: number) {
  const k = (y - Y_MIN) / (Y_MAX - Y_MIN);
  return H - PAD.b - k * (H - PAD.t - PAD.b);
}

function fmtTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

export function ParetoChart({ agents, detect, title, lede, quote, body }: Props) {
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  // Only plot agents that have reasoning data
  const points = detect
    .filter((d) => typeof d.reasoningTokensPerTask === "number" && d.reasoningTokensPerTask > 0)
    .map((d) => ({
      id: d.agentId,
      color: byId.get(d.agentId)?.color ?? "#888",
      x: d.reasoningTokensPerTask as number,
      y: d.f1,
    }));

  // Frontier: agents that achieve the highest F1 for their level of effort or less
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

  const xTicks = [100, 300, 1000, 3000, 10000];
  const yTicks = [0.5, 0.6, 0.7, 0.8, 0.9];

  const hasData = points.length > 0;

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">Reasoning effort</div>
            <h2>{title}</h2>
            <p className="lede">{lede}</p>
          </div>
        </div>

        <div className="grid-2">
          <div className="chart-card">
            {hasData ? (
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
                      {fmtTokens(x)}
                    </text>
                  </g>
                ))}
                <text className="axis-label" x={W / 2} y={H - 8} textAnchor="middle">
                  reasoning tokens per task (log scale)
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
            ) : (
              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  color: "var(--mute)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                No reasoning-token data yet for any agent.
                <br />
                Import trials with a <code>reasoning_tokens</code> field
                via <a href="/admin/runs/import-trials">Import</a> and they'll appear here.
              </div>
            )}
          </div>

          <div className="commentary">
            <div className="quote">{renderInline(quote)}</div>
            <p>{renderInline(body)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
