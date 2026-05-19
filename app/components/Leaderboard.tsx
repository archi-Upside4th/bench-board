"use client";
import { useMemo, useState } from "react";
import type { Agent, DetectResult, ExploitResult } from "@/db/schema";

type Props = {
  agents: Agent[];
  detect: DetectResult[];
  exploit: ExploitResult[];
};

export function Leaderboard({ agents, detect, exploit }: Props) {
  const [mode, setMode] = useState<"detect" | "exploit">("detect");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const detectSorted = useMemo(
    () => [...detect].sort((a, b) => b.f1 - a.f1),
    [detect]
  );
  const exploitSorted = useMemo(
    () => [...exploit].sort((a, b) => b.success - a.success),
    [exploit]
  );

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">Main results</div>
            <h2>Agent ranking</h2>
            <p className="lede">
              Switch modes to compare detection F1 vs exploit success rate.
              Confidence intervals from 3 trials × bootstrap.
            </p>
          </div>
          <div className="tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={mode === "detect"}
              onClick={() => setMode("detect")}
            >
              Detect <span className="count">{detect.length}</span>
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={mode === "exploit"}
              onClick={() => setMode("exploit")}
            >
              Exploit <span className="count">{exploit.length}</span>
            </button>
          </div>
        </div>

        <div className="lb-card">
          <div className="lb-scroll">
            {mode === "detect" ? (
              <table className="lb">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Vendor</th>
                    <th>F1 (95% CI)</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>$/task</th>
                    <th>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {detectSorted.map((r, i) => {
                    const a = byId.get(r.agentId);
                    const ci = ((r.f1CiHigh - r.f1CiLow) / 2).toFixed(2);
                    return (
                      <tr key={r.agentId} className={i === 0 ? "top" : ""}>
                        <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                        <td>
                          <div className="agent-cell">
                            <span className="agent-swatch" style={{ background: a?.color }} />
                            <span className="agent-name">{r.agentId}</span>
                          </div>
                        </td>
                        <td className="vendor">{a?.vendor}</td>
                        <td className="num-col">
                          {r.f1.toFixed(2)}
                          <span className="ci">±{ci}</span>
                          <span className="bar-inline">
                            <i style={{ width: `${Math.round(r.f1 * 100)}%` }} />
                          </span>
                        </td>
                        <td className="num-col">{r.precision.toFixed(2)}</td>
                        <td className="num-col">{r.recall.toFixed(2)}</td>
                        <td className="num-col">${r.costUsdPerTask.toFixed(2)}</td>
                        <td className="num-col">{r.nTasks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="lb">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Agent</th>
                    <th>Vendor</th>
                    <th>Outcome</th>
                    <th>Success</th>
                    <th>Partial</th>
                    <th>Fail</th>
                    <th>$/task</th>
                    <th>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {exploitSorted.map((r, i) => {
                    const a = byId.get(r.agentId);
                    return (
                      <tr key={r.agentId} className={i === 0 ? "top" : ""}>
                        <td className="rank-col">{String(i + 1).padStart(2, "0")}</td>
                        <td>
                          <div className="agent-cell">
                            <span className="agent-swatch" style={{ background: a?.color }} />
                            <span className="agent-name">{r.agentId}</span>
                          </div>
                        </td>
                        <td className="vendor">{a?.vendor}</td>
                        <td>
                          <span className="seg" aria-hidden="true">
                            <i className="s-good" style={{ width: `${r.success * 100}%` }} />
                            <i className="s-warn" style={{ width: `${r.partial * 100}%` }} />
                            <i className="s-bad" style={{ width: `${r.fail * 100}%` }} />
                          </span>
                        </td>
                        <td className="num-col cell-good">{(r.success * 100).toFixed(0)}%</td>
                        <td className="num-col cell-warn">{(r.partial * 100).toFixed(0)}%</td>
                        <td className="num-col cell-bad">{(r.fail * 100).toFixed(0)}%</td>
                        <td className="num-col">${r.costUsdPerTask.toFixed(2)}</td>
                        <td className="num-col">{r.nTasks}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
