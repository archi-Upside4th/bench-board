"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CustomAgent, CustomAgentResult, CustomAgentExploitResult } from "@/db/schema";

type Props = {
  agents: CustomAgent[];
  detect: CustomAgentResult[];
  exploit: CustomAgentExploitResult[];
  title: string;
  lede: string;
};

export function AgentRanking({ agents, detect, exploit, title, lede }: Props) {
  const [mode, setMode] = useState<"detect" | "exploit">("detect");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const detectSorted = useMemo(() => [...detect].sort((a, b) => b.f1 - a.f1), [detect]);
  const exploitSorted = useMemo(() => [...exploit].sort((a, b) => b.success - a.success), [exploit]);

  // Sliding tab indicator (same pattern as Leaderboard)
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const detectBtnRef = useRef<HTMLButtonElement | null>(null);
  const exploitBtnRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });
  const measure = () => {
    const target = mode === "detect" ? detectBtnRef.current : exploitBtnRef.current;
    if (!target) return;
    setIndicator({ x: target.offsetLeft, w: target.offsetWidth, ready: true });
  };
  useLayoutEffect(measure, [mode]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    if (detectBtnRef.current) ro.observe(detectBtnRef.current);
    if (exploitBtnRef.current) ro.observe(exploitBtnRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEmpty = detect.length === 0 && exploit.length === 0;

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <h2>{title}</h2>
            <p className="lede">{lede}</p>
          </div>
          {isEmpty ? null : (
            <div className="tabs has-slider" role="tablist" ref={tabsRef}>
              <span
                className="tab-slider"
                aria-hidden="true"
                style={{
                  transform: `translateX(${indicator.x}px)`,
                  width: indicator.w,
                  opacity: indicator.ready ? 1 : 0,
                }}
              />
              <button
                ref={detectBtnRef}
                className="tab"
                role="tab"
                aria-selected={mode === "detect"}
                onClick={() => setMode("detect")}
              >
                Detect <span className="count">{detect.length}</span>
              </button>
              <button
                ref={exploitBtnRef}
                className="tab"
                role="tab"
                aria-selected={mode === "exploit"}
                onClick={() => setMode("exploit")}
              >
                Exploit <span className="count">{exploit.length}</span>
              </button>
            </div>
          )}
        </div>

        <div className="lb-card">
          <div className="lb-stack">
            <div className={`lb-pane ${mode === "detect" ? "on" : ""}`} aria-hidden={mode !== "detect"}>
              <div className="lb-scroll">
                {detectSorted.length === 0 ? (
                  <Empty mode="Detect" />
                ) : (
                  <table className="lb">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Agent</th>
                        <th>Vendor</th>
                        <th>F1 (95% CI)</th>
                        <th className="num">Precision</th>
                        <th className="num">Recall</th>
                        <th className="num">$/task</th>
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
                            <td className="num">{r.precision.toFixed(2)}</td>
                            <td className="num">{r.recall.toFixed(2)}</td>
                            <td className="num">${r.costUsdPerTask.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className={`lb-pane ${mode === "exploit" ? "on" : ""}`} aria-hidden={mode !== "exploit"}>
              <div className="lb-scroll">
                {exploitSorted.length === 0 ? (
                  <Empty mode="Exploit" />
                ) : (
                  <table className="lb">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Agent</th>
                        <th>Vendor</th>
                        <th>Outcome</th>
                        <th className="num">Success</th>
                        <th className="num">Partial</th>
                        <th className="num">Fail</th>
                        <th className="num">$/task</th>
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
                            <td className="num cell-good">{(r.success * 100).toFixed(0)}%</td>
                            <td className="num cell-warn">{(r.partial * 100).toFixed(0)}%</td>
                            <td className="num cell-bad">{(r.fail * 100).toFixed(0)}%</td>
                            <td className="num">${r.costUsdPerTask.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Empty({ mode }: { mode: string }) {
  return (
    <div style={{ padding: 36, textAlign: "center", color: "var(--mute)", fontSize: 13.5, lineHeight: 1.6 }}>
      No {mode} results for this run yet.
      <br />
      Add them in <a href="/admin">admin</a> → open the run → <b>Agent ranking</b> section.
    </div>
  );
}
