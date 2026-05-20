"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CustomAgent, CustomAgentResult } from "@/db/schema";
import { InlineCell } from "./InlineCell";
import { AddRowPicker, DeleteRowButton } from "./RowCrudControls";
import {
  updateCustomAgentCell,
  updateDetectCiHalf,
  addCustomAgentRow,
  deleteCustomAgentRow,
  upsertCustomAgent,
  deleteCustomAgent,
} from "@/lib/actions";

type Props = {
  runId: number;
  agents: CustomAgent[];
  results: CustomAgentResult[];
};

// Note: CI half-width editing reuses the same symmetric-around-F1 server action;
// it's keyed by (runId, agentId) and writes to the underlying results table.
// For custom agents we'd need a parallel action — for now CI just shows ±0.

const DEFAULT_PALETTE = [
  "#D97757", "#10A37F", "#4285F4", "#7C3AED",
  "#FF6A00", "#22D3EE", "#F472B6", "#A3E635",
];
function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEFAULT_PALETTE[h % DEFAULT_PALETTE.length];
}

export function EditableAgentRanking({ runId, agents, results }: Props) {
  const router = useRouter();
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const sorted = useMemo(() => [...results].sort((a, b) => b.f1 - a.f1), [results]);

  const haveInRun = new Set(results.map((r) => r.agentId));
  const available = agents.filter((a) => !haveInRun.has(a.id));

  const fmt2 = (v: number) => v.toFixed(2);
  const fmtMoney = (v: number) => "$" + v.toFixed(2);
  const fmtInt = (v: number) => String(Math.round(v));

  // Inline "new custom agent" form state
  const [showNew, setShowNew] = useState(false);
  const [newId, setNewId] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 7));
  const [newColor, setNewColor] = useState(pickColor(""));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submitNewAgent() {
    setErr(null);
    if (!newId.trim()) return setErr("Agent ID is required.");
    if (!newVendor.trim()) return setErr("Vendor is required.");
    if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) return setErr("Color must be a 6-digit hex.");
    start(async () => {
      try {
        await upsertCustomAgent({
          id: newId.trim(),
          vendor: newVendor.trim(),
          release_date: newDate.trim(),
          color: newColor,
        });
        // Auto-add to this run with zeroes
        await addCustomAgentRow({ runId, agentId: newId.trim() });
        setNewId(""); setNewVendor(""); setNewColor(pickColor("")); setShowNew(false);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  function deleteAgentEverywhere(id: string) {
    if (!confirm(`Permanently delete custom agent "${id}"? Removes it from every run.`)) return;
    start(async () => {
      await deleteCustomAgent(id);
      router.refresh();
    });
  }

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">Coding agents — editable</div>
          <h2 style={{ fontSize: 22 }}>Agent ranking data</h2>
          <p className="lede">
            Custom agents (Claude Code, Codex, V12, Sherlock, …). Stored separately
            from the LLM ranking — populate independently as you have measurements.
          </p>
        </div>
      </div>

      <div className="lb-card">
        <div className="lb-scroll">
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const a = byId.get(r.agentId);
                const base = { runId, agentId: r.agentId } as const;
                const ciHalf = (r.f1CiHigh - r.f1CiLow) / 2;
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
                      <InlineCell
                        initial={r.f1}
                        fmt={fmt2}
                        validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                        action={updateCustomAgentCell}
                        actionInput={{ ...base, field: "f1" }}
                        width={56}
                        align="left"
                      />
                      <span className="ci" style={{ marginLeft: 4 }}>
                        ±
                        <InlineCell
                          initial={ciHalf}
                          fmt={fmt2}
                          validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                          action={async (input) => {
                            // Reuse the detect CI symmetric writer on the custom_agent_results
                            // table by updating both CI low / high directly via two cell writes.
                            const { value } = input as { value: number };
                            await updateCustomAgentCell({ ...base, field: "f1CiLow", value: Math.max(0, r.f1 - value) });
                            await updateCustomAgentCell({ ...base, field: "f1CiHigh", value: Math.min(1, r.f1 + value) });
                            router.refresh();
                            // detectCiHalf would have done it for detect_results, but custom_agent_results needs its own pair
                            void updateDetectCiHalf;
                          }}
                          actionInput={base}
                          width={48}
                          align="left"
                        />
                      </span>
                      <span className="bar-inline">
                        <i style={{ width: `${Math.round(r.f1 * 100)}%` }} />
                      </span>
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.precision}
                        fmt={fmt2}
                        validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                        action={updateCustomAgentCell}
                        actionInput={{ ...base, field: "precision" }}
                        width={56}
                      />
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.recall}
                        fmt={fmt2}
                        validate={(x) => (x < 0 || x > 1 ? "0–1" : null)}
                        action={updateCustomAgentCell}
                        actionInput={{ ...base, field: "recall" }}
                        width={56}
                      />
                    </td>
                    <td className="num">
                      <InlineCell
                        initial={r.costUsdPerTask}
                        fmt={fmtMoney}
                        parse={(s) => Number(s.replace("$", ""))}
                        action={updateCustomAgentCell}
                        actionInput={{ ...base, field: "costUsdPerTask" }}
                        width={70}
                      />
                    </td>
                    <td>
                      <DeleteRowButton
                        runId={runId}
                        agentId={r.agentId}
                        action={deleteCustomAgentRow}
                        confirmText={`Remove ${r.agentId} from Agent ranking for this run?`}
                      />
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No agent results yet — create one below.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-row" style={{ marginTop: 14, gap: 14, flexWrap: "wrap" }}>
        <AddRowPicker
          runId={runId}
          available={available.map((a) => ({ id: a.id, vendor: a.vendor, color: a.color, releaseDate: a.releaseDate, createdAt: new Date() }))}
          action={addCustomAgentRow}
          label="+ Add existing agent"
        />
        <button
          type="button"
          className={showNew ? "ghost-btn" : "primary-btn"}
          onClick={() => setShowNew((v) => !v)}
        >
          {showNew ? "Cancel" : "+ New custom agent"}
        </button>
      </div>

      {showNew ? (
        <div
          style={{
            marginTop: 14, padding: 18,
            border: "1px solid var(--line)", borderRadius: 10,
            background: "var(--bg-card)",
          }}
        >
          <h3 style={{ fontSize: 13, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            New custom agent
          </h3>
          {err ? <div className="adm-banner err" style={{ marginTop: 10, fontSize: 12 }}>{err}</div> : null}
          <div className="adm-grid cols-4" style={{ marginTop: 14, gap: 12 }}>
            <div className="adm-field">
              <span className="adm-label">ID</span>
              <input
                className="adm-input"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                onBlur={() => { if (!newColor || newColor === pickColor("")) setNewColor(pickColor(newId)); }}
                placeholder="claude-code"
                style={{ fontFamily: "var(--mono)" }}
              />
            </div>
            <div className="adm-field">
              <span className="adm-label">Vendor</span>
              <input
                className="adm-input"
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                placeholder="Anthropic"
              />
            </div>
            <div className="adm-field">
              <span className="adm-label">Release (YYYY-MM)</span>
              <input
                className="adm-input"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                placeholder="2025-09"
              />
            </div>
            <div className="adm-field">
              <span className="adm-label">Color</span>
              <div className="adm-row">
                <input
                  type="color"
                  className="adm-color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
                <input
                  className="adm-input"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  style={{ fontFamily: "var(--mono)", width: 110 }}
                />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="primary-btn" onClick={submitNewAgent} disabled={pending}>
              {pending ? "Creating…" : "Create + add to this run"}
            </button>
          </div>
        </div>
      ) : null}

      {agents.length > 0 ? (
        <div style={{ marginTop: 18, fontSize: 11.5, color: "var(--mute)" }}>
          All custom agents:{" "}
          {agents.map((a, i) => (
            <span key={a.id} style={{ fontFamily: "var(--mono)", marginLeft: i ? 8 : 0 }}>
              {a.id}
              <button
                type="button"
                onClick={() => deleteAgentEverywhere(a.id)}
                title={`Permanently delete ${a.id}`}
                style={{ marginLeft: 4, background: "transparent", border: 0, color: "var(--mute-2)", cursor: "pointer", padding: 0, fontSize: 12 }}
              >
                ×
              </button>
              {i < agents.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
