"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/db/schema";
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
} from "@/lib/actions";

type Props = {
  runId: number;
  agents: Agent[];
  categories: string[];
  ratesByAgent: Map<string, Map<string, number>>;
};

const MAX = 1.0;
const TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

export function EditableFpTable({ runId, agents, categories, ratesByAgent }: Props) {
  const router = useRouter();
  const [showGrid, setShowGrid] = useState(false);
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  // Mean per agent (matches the public chart)
  const agentMeans = useMemo(() => {
    return Array.from(ratesByAgent.entries())
      .map(([agentId, rates]) => {
        const vals = categories
          .map((c) => rates.get(c))
          .filter((v): v is number => typeof v === "number");
        const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        return { agentId, mean };
      })
      .sort((a, b) => a.mean - b.mean);
  }, [ratesByAgent, categories]);

  const fpAgentIds = Array.from(ratesByAgent.keys());
  const availableAgents = agents.filter((a) => !ratesByAgent.has(a.id));

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">False positives — editable</div>
          <h2 style={{ fontSize: 22 }}>FP rate on hardened decoys</h2>
          <p className="lede">
            Bars are computed from the per-category values. Toggle "Edit by category" to edit each cell.
          </p>
        </div>
        <div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setShowGrid((v) => !v)}
          >
            {showGrid ? "Show preview bars" : "Edit by category"}
          </button>
        </div>
      </div>

      {/* Preview matches public chart structure */}
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
                <span key={v} style={{ left: `${(v / MAX) * 100}%` }}>
                  {v.toFixed(1)}
                </span>
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
                No FP rates yet. Switch to "Edit by category" to add a category and an agent.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        // Per-cell edit grid
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 180 }}>Agent</th>
                {categories.map((c) => (
                  <th key={c} className="num" style={{ fontFamily: "var(--mono)", fontSize: 10, textTransform: "none", letterSpacing: 0, color: "var(--ink-2)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {c}
                      <DeleteCategoryButton runId={runId} category={c} action={deleteFpCategory} />
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
                            action={async (i) => { await updateFpCell(i as { runId: number; agentId: string; category: string; value: number }); router.refresh(); }}
                            actionInput={{ runId, agentId, category: c }}
                            width={56}
                          />
                        </td>
                      );
                    })}
                    <td>
                      <DeleteRowButton runId={runId} agentId={agentId} action={deleteFpAgentRow} confirmText={`Remove ${agentId}'s FP rates from this run?`} />
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
          available={availableAgents}
          action={addFpAgentRow}
        />
        <AddCategoryControl runId={runId} action={addFpCategory} />
      </div>
    </section>
  );
}
