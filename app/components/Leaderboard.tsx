"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Agent, DetectResult, ExploitResult } from "@/db/schema";

type Props = {
  agents: Agent[];
  detect: DetectResult[];
  exploit: ExploitResult[];
  title: string;
  lede: string;
  isAdmin?: boolean;
};

export function Leaderboard({ agents, detect, exploit, title, lede, isAdmin }: Props) {
  const [mode, setMode] = useState<"detect" | "exploit">("detect");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const detectBtnRef = useRef<HTMLButtonElement | null>(null);
  const exploitBtnRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });

  const measure = () => {
    const target = mode === "detect" ? detectBtnRef.current : exploitBtnRef.current;
    const host = tabsRef.current;
    if (!target || !host) return;
    setIndicator({ x: target.offsetLeft, w: target.offsetWidth, ready: true });
  };

  // Layout-sync measurement: no flash on initial render, no flash on mode change
  useLayoutEffect(measure, [mode]);

  // Re-measure on resize and after fonts settle
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    if (detectBtnRef.current) ro.observe(detectBtnRef.current);
    if (exploitBtnRef.current) ro.observe(exploitBtnRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchMode(next: "detect" | "exploit") {
    if (next === mode) return;
    setMode(next);
  }

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
            <h2>{title}</h2>
            <p className="lede">{lede}</p>
          </div>
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
              onClick={() => switchMode("detect")}
            >
              Detect <span className="count">{detect.length}</span>
            </button>
            <button
              ref={exploitBtnRef}
              className="tab"
              role="tab"
              aria-selected={mode === "exploit"}
              onClick={() => switchMode("exploit")}
            >
              Exploit <span className="count">{exploit.length}</span>
            </button>
          </div>
        </div>

        <div className="lb-card">
          <div className="lb-stack">
            <div className={`lb-pane ${mode === "detect" ? "on" : ""}`} aria-hidden={mode !== "detect"}>
              <div className="lb-scroll">
                {detectSorted.length === 0 ? (
                  <Empty mode="Detect" isAdmin={isAdmin} />
                ) : (
                <table className="lb">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Model</th>
                      <th>Vendor</th>
                      <th>F1 (95% CI)</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>$/task</th>
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
                  <Empty mode="Exploit" isAdmin={isAdmin} />
                ) : (
                <table className="lb">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Model</th>
                      <th>Vendor</th>
                      <th>Outcome</th>
                      <th>Success</th>
                      <th>Partial</th>
                      <th>Fail</th>
                      <th>$/task</th>
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

function Empty({ mode, isAdmin }: { mode: string; isAdmin?: boolean }) {
  return (
    <div style={{ padding: 36, textAlign: "center", color: "var(--mute)", fontSize: 13.5, lineHeight: 1.6 }}>
      No {mode} results yet.
      {isAdmin ? (
        <>
          <br />
          Add them in <a href="/admin">admin</a> → open the run → <b>LLM ranking</b> section.
        </>
      ) : null}
    </div>
  );
}
