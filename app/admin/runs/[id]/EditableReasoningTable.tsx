"use client";

import { useMemo } from "react";
import type { Agent, ReasoningPoint } from "@/db/schema";
import { InlineCell } from "./InlineCell";
import { AddRowPicker, DeleteRowButton } from "./RowCrudControls";
import {
  updateReasoningCell,
  addReasoningRow,
  deleteReasoningRow,
} from "@/lib/actions";

type Props = {
  runId: number;
  agents: Agent[];
  points: ReasoningPoint[];
};

export function EditableReasoningTable({ runId, agents, points }: Props) {
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.reasoningTokensPerTask - b.reasoningTokensPerTask),
    [points]
  );
  const have = new Set(points.map((p) => p.agentId));
  const available = agents.filter((a) => !have.has(a.id));

  const fmt2 = (v: number) => v.toFixed(2);
  const fmtInt = (v: number) => String(Math.round(v));

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">Reasoning effort — editable</div>
          <h2 style={{ fontSize: 22 }}>Reasoning frontier data</h2>
          <p className="lede">
            Standalone data for the Reasoning frontier chart. F1 and reasoning-token
            values here are independent of the Detect table — populate per agent as
            you have measurements.
          </p>
        </div>
      </div>

      <div className="lb-card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 16px" }}>Agent</th>
                <th className="num">F1 score</th>
                <th className="num">Reasoning tokens / task</th>
                <th className="num">N tasks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const a = byId.get(r.agentId);
                const base = { runId, agentId: r.agentId } as const;
                return (
                  <tr key={r.agentId}>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="agent-cell">
                        <span className="agent-swatch" style={{ background: a?.color }} />
                        <span className="agent-name">{r.agentId}</span>
                      </div>
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.f1}
                        fmt={fmt2}
                        validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                        action={updateReasoningCell}
                        actionInput={{ ...base, field: "f1" }}
                        width={64}
                      />
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.reasoningTokensPerTask}
                        fmt={fmtInt}
                        validate={(x) => (x < 0 ? "≥ 0" : null)}
                        action={updateReasoningCell}
                        actionInput={{ ...base, field: "reasoningTokensPerTask" }}
                        width={80}
                      />
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.nTasks}
                        fmt={fmtInt}
                        action={updateReasoningCell}
                        actionInput={{ ...base, field: "nTasks" }}
                        width={64}
                      />
                    </td>
                    <td>
                      <DeleteRowButton
                        runId={runId}
                        agentId={r.agentId}
                        action={deleteReasoningRow}
                        confirmText={`Remove ${r.agentId} from the Reasoning frontier?`}
                      />
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>
                    No reasoning data yet — add an agent below.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <AddRowPicker
          runId={runId}
          available={available}
          action={addReasoningRow}
          label="+ Add agent to reasoning chart"
        />
      </div>
    </section>
  );
}
