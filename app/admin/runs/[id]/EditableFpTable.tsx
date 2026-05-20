"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent, CustomAgent } from "@/db/schema";
import { InlineCell } from "./InlineCell";
import {
  AddRowPicker,
  DeleteRowButton,
  AddCategoryControl,
  DeleteCategoryButton,
} from "./RowCrudControls";
import {
  updateFpCell,
  addFpCategory,
  deleteFpCategory,
  addFpAgentRow,
  deleteFpAgentRow,
  updateCustomAgentFpCell,
  addCustomAgentFpCategory,
  deleteCustomAgentFpCategory,
  addCustomAgentFpRow,
  deleteCustomAgentFpRow,
} from "@/lib/actions";

type Props = {
  runId: number;
  llmAgents: Agent[];
  llmCategories: string[];
  llmRatesByAgent: Map<string, Map<string, number>>;
  customAgents: CustomAgent[];
  customCategories: string[];
  customRatesByAgent: Map<string, Map<string, number>>;
};

const MAX = 1.0;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

type GenericAgent = { id: string; vendor: string; color: string; releaseDate: string; createdAt: Date };

export function EditableFpTable({
  runId,
  llmAgents,
  llmCategories,
  llmRatesByAgent,
  customAgents,
  customCategories,
  customRatesByAgent,
}: Props) {
  const [mode, setMode] = useState<"llm" | "agent">("llm");
  const [showGrid, setShowGrid] = useState(false);

  // Sliding tab
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

  const activeAgents: GenericAgent[] = mode === "llm"
    ? llmAgents.map((a) => ({ id: a.id, vendor: a.vendor, color: a.color, releaseDate: a.releaseDate, createdAt: new Date() }))
    : customAgents.map((a) => ({ id: a.id, vendor: a.vendor, color: a.color, releaseDate: a.releaseDate, createdAt: new Date() }));
  const activeCategories = mode === "llm" ? llmCategories : customCategories;
  const activeRatesByAgent = mode === "llm" ? llmRatesByAgent : customRatesByAgent;

  const activeActions = mode === "llm"
    ? { cell: updateFpCell, addCat: addFpCategory, delCat: deleteFpCategory, addRow: addFpAgentRow, delRow: deleteFpAgentRow }
    : { cell: updateCustomAgentFpCell, addCat: addCustomAgentFpCategory, delCat: deleteCustomAgentFpCategory, addRow: addCustomAgentFpRow, delRow: deleteCustomAgentFpRow };

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">False positives — editable</div>
          <h2 style={{ fontSize: 22 }}>FP rate on hardened decoys</h2>
          <p className="lede">
            Bars are computed from per-category values. Toggle &quot;Edit by category&quot; to edit each cell. Tabs split LLMs from custom agents.
          </p>
        </div>
        <div className="adm-row" style={{ gap: 10 }}>
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
              LLM <span className="count">{llmRatesByAgent.size}</span>
            </button>
            <button
              ref={agentBtnRef}
              className="tab"
              role="tab"
              aria-selected={mode === "agent"}
              onClick={() => setMode("agent")}
            >
              Agent <span className="count">{customRatesByAgent.size}</span>
            </button>
          </div>
          <button type="button" className="ghost-btn" onClick={() => setShowGrid((v) => !v)}>
            {showGrid ? "Show preview bars" : "Edit by category"}
          </button>
        </div>
      </div>

      <FpPane
        runId={runId}
        agents={activeAgents}
        categories={activeCategories}
        ratesByAgent={activeRatesByAgent}
        showGrid={showGrid}
        actions={activeActions}
      />
    </section>
  );
}

function FpPane({
  runId,
  agents,
  categories,
  ratesByAgent,
  showGrid,
  actions,
}: {
  runId: number;
  agents: GenericAgent[];
  categories: string[];
  ratesByAgent: Map<string, Map<string, number>>;
  showGrid: boolean;
  actions: {
    cell: (input: { runId: number; agentId: string; category: string; value: number }) => Promise<void>;
    addCat: (input: { runId: number; category: string }) => Promise<void>;
    delCat: (input: { runId: number; category: string }) => Promise<void>;
    addRow: (input: { runId: number; agentId: string }) => Promise<void>;
    delRow: (input: { runId: number; agentId: string }) => Promise<void>;
  };
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const agentMeans = useMemo(() => {
    return Array.from(ratesByAgent.entries())
      .map(([agentId, rates]) => {
        const vals = categories.map((c) => rates.get(c)).filter((v): v is number => typeof v === "number");
        const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        return { agentId, mean };
      })
      .sort((a, b) => a.mean - b.mean);
  }, [ratesByAgent, categories]);

  const fpAgentIds = Array.from(ratesByAgent.keys());
  const availableAgents = agents.filter((a) => !ratesByAgent.has(a.id));

  return (
    <>
      {!showGrid ? (
        <div className="lb-card fp-card">
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
                        left: 0, top: 2, bottom: 2, height: "auto",
                        width: `${w}%`, background: color, opacity: 0.9,
                      }}
                    />
                  </div>
                  <div className="fp-mean">{mean.toFixed(2)}</div>
                </div>
              );
            })}
            {agentMeans.length === 0 ? (
              <p className="lede" style={{ padding: 20, fontSize: 13 }}>
                No FP rates yet. Switch to &quot;Edit by category&quot; to add a category and an agent.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 180 }}>Agent</th>
                {categories.map((c) => (
                  <th key={c} className="num" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "none", letterSpacing: 0, color: "var(--ink-2)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {c}
                      <DeleteCategoryButton runId={runId} category={c} action={actions.delCat} />
                    </span>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fpAgentIds.map((agentId) => {
                const a = byId.get(agentId);
                const rates = ratesByAgent.get(agentId)!;
                return (
                  <tr key={agentId}>
                    <td>
                      <div className="agent-cell">
                        <span className="agent-swatch" style={{ background: a?.color }} />
                        <span className="agent-name">{agentId}</span>
                      </div>
                    </td>
                    {categories.map((c) => {
                      const v = rates.get(c) ?? 0;
                      return (
                        <td key={c} className="num">
                          <InlineCell
                            initial={v}
                            fmt={(x) => x.toFixed(2)}
                            validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                            action={async (i) => { await actions.cell(i as { runId: number; agentId: string; category: string; value: number }); router.refresh(); }}
                            actionInput={{ runId, agentId, category: c }}
                            width={56}
                          />
                        </td>
                      );
                    })}
                    <td>
                      <DeleteRowButton runId={runId} agentId={agentId} action={actions.delRow} confirmText={`Remove ${agentId}'s FP rates from this run?`} />
                    </td>
                  </tr>
                );
              })}
              {fpAgentIds.length === 0 ? (
                <tr><td colSpan={Math.max(2, categories.length + 2)} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No FP rates yet — add a category, then an agent.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <div className="adm-row" style={{ marginTop: 14, gap: 16, flexWrap: "wrap" }}>
        <AddRowPicker
          runId={runId}
          available={availableAgents.map((a) => ({ id: a.id, vendor: a.vendor, color: a.color, releaseDate: a.releaseDate, createdAt: a.createdAt }))}
          action={actions.addRow}
        />
        <AddCategoryControl runId={runId} action={actions.addCat} />
      </div>
    </>
  );
}
