"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Row = { agentId: string; values: { category: string; rate: number }[] };
type AnyAgent = { id: string; color: string };

type Props = {
  llmAgents: AnyAgent[];
  llmCategories: string[];
  llmRows: Row[];
  customAgents: AnyAgent[];
  customCategories: string[];
  customRows: Row[];
  title: string;
  lede: string;
  isAdmin?: boolean;
};

const MAX = 1.0;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export function FpAnalysis({
  llmAgents,
  llmCategories,
  llmRows,
  customAgents,
  customCategories,
  customRows,
  title,
  lede,
  isAdmin,
}: Props) {
  const [mode, setMode] = useState<"llm" | "agent">("llm");

  // Sliding tab indicator
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const llmBtnRef = useRef<HTMLButtonElement | null>(null);
  const agentBtnRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false });
  const measure = () => {
    const target = mode === "llm" ? llmBtnRef.current : agentBtnRef.current;
    if (!target) return;
    setIndicator({ x: target.offsetLeft, w: target.offsetWidth, ready: true });
  };
  useLayoutEffect(measure, [mode]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    if (llmBtnRef.current) ro.observe(llmBtnRef.current);
    if (agentBtnRef.current) ro.observe(agentBtnRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <div className="wrap">
        <div className="section-head">
          <div className="left">
            <div className="section-eyebrow">False positives</div>
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
              ref={llmBtnRef}
              className="tab"
              role="tab"
              aria-selected={mode === "llm"}
              onClick={() => setMode("llm")}
            >
              LLM <span className="count">{llmRows.length}</span>
            </button>
            <button
              ref={agentBtnRef}
              className="tab"
              role="tab"
              aria-selected={mode === "agent"}
              onClick={() => setMode("agent")}
            >
              Agent <span className="count">{customRows.length}</span>
            </button>
          </div>
        </div>

        <div className="lb-card fp-card">
          <FpHead />
          {mode === "llm" ? (
            <FpBars agents={llmAgents} categories={llmCategories} rows={llmRows} emptyLabel="LLM" isAdmin={isAdmin} />
          ) : (
            <FpBars agents={customAgents} categories={customCategories} rows={customRows} emptyLabel="Agent" isAdmin={isAdmin} />
          )}
        </div>
      </div>
    </section>
  );
}

function FpHead() {
  return (
    <>
      <div className="fp-head">
        <div className="fp-head-cell">Agent</div>
        <div className="fp-head-cell">FP rate</div>
        <div className="fp-head-cell right">Mean</div>
      </div>
      <div className="fp-axis">
        <div />
        <div className="axis-ticks">
          {TICKS.map((v) => (
            <span key={v} style={{ left: `${(v / MAX) * 100}%` }}>{v.toFixed(1)}</span>
          ))}
        </div>
        <div />
      </div>
    </>
  );
}

function FpBars({
  agents,
  categories,
  rows,
  emptyLabel,
  isAdmin,
}: {
  agents: AnyAgent[];
  categories: string[];
  rows: Row[];
  emptyLabel: string;
  isAdmin?: boolean;
}) {
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const means = useMemo(() => {
    return rows
      .map((r) => {
        const vals = r.values.map((v) => v.rate);
        const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        return { agentId: r.agentId, mean };
      })
      .sort((a, b) => a.mean - b.mean);
  }, [rows]);

  if (means.length === 0 || categories.length === 0) {
    return (
      <div style={{ padding: 36, textAlign: "center", color: "var(--mute)", fontSize: 13.5, lineHeight: 1.6 }}>
        No {emptyLabel} FP data yet.
        {isAdmin ? (
          <>
            <br />
            Add it in <a href="/admin">admin</a> → open the run → <b>False positives</b> section.
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {means.map(({ agentId, mean }, ai) => {
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
                  left: 0, top: 2, bottom: 2, height: "auto",
                  width: `${w}%`, background: color, opacity: 0.9,
                }}
              />
            </div>
            <div className="fp-mean">{mean.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}
