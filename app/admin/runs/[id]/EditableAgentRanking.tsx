"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CustomAgent, CustomAgentResult, CustomAgentExploitResult } from "@/db/schema";
import { InlineCell } from "./InlineCell";
import { AddRowPicker, DeleteRowButton } from "./RowCrudControls";
import {
  updateCustomAgentCell,
  addCustomAgentRow,
  deleteCustomAgentRow,
  updateCustomAgentExploitCell,
  addCustomAgentExploitRow,
  deleteCustomAgentExploitRow,
  upsertCustomAgent,
  deleteCustomAgent,
} from "@/lib/actions";

type Props = {
  runId: number;
  agents: CustomAgent[];
  detect: CustomAgentResult[];
  exploit: CustomAgentExploitResult[];
};

const DEFAULT_PALETTE = [
  "#D97757", "#10A37F", "#4285F4", "#7C3AED",
  "#FF6A00", "#22D3EE", "#F472B6", "#A3E635",
];
function pickColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return DEFAULT_PALETTE[h % DEFAULT_PALETTE.length];
}

export function EditableAgentRanking({ runId, agents, detect, exploit }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"detect" | "exploit">("detect");
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const detectSorted = useMemo(() => [...detect].sort((a, b) => b.f1 - a.f1), [detect]);
  const exploitSorted = useMemo(() => [...exploit].sort((a, b) => b.success - a.success), [exploit]);

  const haveDetect = new Set(detect.map((r) => r.agentId));
  const haveExploit = new Set(exploit.map((r) => r.agentId));
  const availableDetect = agents.filter((a) => !haveDetect.has(a.id));
  const availableExploit = agents.filter((a) => !haveExploit.has(a.id));

  // Tab slider
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

  // New-agent inline form
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
          id: newId.trim(), vendor: newVendor.trim(),
          release_date: newDate.trim(), color: newColor,
        });
        // Auto-add to whichever mode we're currently viewing
        if (mode === "detect") {
          await addCustomAgentRow({ runId, agentId: newId.trim() });
        } else {
          await addCustomAgentExploitRow({ runId, agentId: newId.trim() });
        }
        setNewId(""); setNewVendor(""); setNewColor(pickColor("")); setShowNew(false);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  function deleteAgentEverywhere(id: string) {
    if (!confirm(`Permanently delete custom agent "${id}"? Removes it from every run, both modes.`)) return;
    start(async () => {
      await deleteCustomAgent(id);
      router.refresh();
    });
  }

  const fmt2 = (v: number) => v.toFixed(2);
  const pct = (v: number) => (v * 100).toFixed(0) + "%";
  const fromPct = (s: string) => Number(s.replace("%", "")) / 100;
  const fmtMoney = (v: number) => "$" + v.toFixed(2);

  return (
    <section>
      <div className="section-head">
        <div className="left">
          <div className="section-eyebrow">Agent ranking — editable</div>
          <h2 style={{ fontSize: 22 }}>Agent ranking data</h2>
          <p className="lede">
            Custom agents and frameworks (Claude Code, Codex, V12, Sherlock, …).
            Stored separately from the LLM ranking. Switch tabs for Detect / Exploit.
          </p>
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
                  <th className="num">Precision</th>
                  <th className="num">Recall</th>
                  <th className="num">$/task</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detectSorted.map((r, i) => {
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
                              const { value } = input as { value: number };
                              await updateCustomAgentCell({ ...base, field: "f1CiLow", value: Math.max(0, r.f1 - value) });
                              await updateCustomAgentCell({ ...base, field: "f1CiHigh", value: Math.min(1, r.f1 + value) });
                              router.refresh();
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
                        <InlineCell initial={r.precision} fmt={fmt2} validate={(x) => (x < 0 || x > 1 ? "0–1" : null)} action={updateCustomAgentCell} actionInput={{ ...base, field: "precision" }} width={56} />
                      </td>
                      <td className="num">
                        <InlineCell initial={r.recall} fmt={fmt2} validate={(x) => (x < 0 || x > 1 ? "0–1" : null)} action={updateCustomAgentCell} actionInput={{ ...base, field: "recall" }} width={56} />
                      </td>
                      <td className="num">
                        <InlineCell initial={r.costUsdPerTask} fmt={fmtMoney} parse={(s) => Number(s.replace("$", ""))} action={updateCustomAgentCell} actionInput={{ ...base, field: "costUsdPerTask" }} width={70} />
                      </td>
                      <td>
                        <DeleteRowButton runId={runId} agentId={r.agentId} action={deleteCustomAgentRow} confirmText={`Remove ${r.agentId} from Detect for this run?`} />
                      </td>
                    </tr>
                  );
                })}
                {detectSorted.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No Detect results yet — add an agent below.</td></tr>
                ) : null}
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
                  <th className="num">Success</th>
                  <th className="num">Partial</th>
                  <th className="num">Fail</th>
                  <th className="num">$/task</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exploitSorted.map((r, i) => {
                  const a = byId.get(r.agentId);
                  const base = { runId, agentId: r.agentId } as const;
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
                      <td className="num cell-good">
                        <InlineCell initial={r.success} fmt={pct} parse={fromPct} validate={(x) => (x < 0 || x > 1 ? "0–1" : null)} action={updateCustomAgentExploitCell} actionInput={{ ...base, field: "success" }} width={56} />
                      </td>
                      <td className="num cell-warn">
                        <InlineCell initial={r.partial} fmt={pct} parse={fromPct} validate={(x) => (x < 0 || x > 1 ? "0–1" : null)} action={updateCustomAgentExploitCell} actionInput={{ ...base, field: "partial" }} width={56} />
                      </td>
                      <td className="num cell-bad">
                        <InlineCell initial={r.fail} fmt={pct} parse={fromPct} validate={(x) => (x < 0 || x > 1 ? "0–1" : null)} action={updateCustomAgentExploitCell} actionInput={{ ...base, field: "fail" }} width={56} />
                      </td>
                      <td className="num">
                        <InlineCell initial={r.costUsdPerTask} fmt={fmtMoney} parse={(s) => Number(s.replace("$", ""))} action={updateCustomAgentExploitCell} actionInput={{ ...base, field: "costUsdPerTask" }} width={70} />
                      </td>
                      <td>
                        <DeleteRowButton runId={runId} agentId={r.agentId} action={deleteCustomAgentExploitRow} confirmText={`Remove ${r.agentId} from Exploit for this run?`} />
                      </td>
                    </tr>
                  );
                })}
                {exploitSorted.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 20, color: "var(--mute)", fontSize: 13 }}>No Exploit results yet — add an agent below.</td></tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="adm-row" style={{ marginTop: 14, gap: 14, flexWrap: "wrap" }}>
        <AddRowPicker
          runId={runId}
          available={(mode === "detect" ? availableDetect : availableExploit).map((a) => ({
            id: a.id, vendor: a.vendor, color: a.color, releaseDate: a.releaseDate, createdAt: new Date(),
          }))}
          action={mode === "detect" ? addCustomAgentRow : addCustomAgentExploitRow}
          label={`+ Add existing agent to ${mode === "detect" ? "Detect" : "Exploit"}`}
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
        <div style={{ marginTop: 14, padding: 18, border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-card)" }}>
          <h3 style={{ fontSize: 13, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
            New custom agent
          </h3>
          <p style={{ fontSize: 11.5, color: "var(--mute-2)", marginTop: 6 }}>
            Will be added to <b>{mode === "detect" ? "Detect" : "Exploit"}</b> for this run after creation.
          </p>
          {err ? <div className="adm-banner err" style={{ marginTop: 10, fontSize: 12 }}>{err}</div> : null}
          <div className="adm-grid cols-4" style={{ marginTop: 14, gap: 12 }}>
            <div className="adm-field">
              <span className="adm-label">ID</span>
              <input className="adm-input" value={newId} onChange={(e) => setNewId(e.target.value)} onBlur={() => { if (!newColor || newColor === pickColor("")) setNewColor(pickColor(newId)); }} placeholder="claude-code" style={{ fontFamily: "var(--mono)" }} />
            </div>
            <div className="adm-field">
              <span className="adm-label">Vendor</span>
              <input className="adm-input" value={newVendor} onChange={(e) => setNewVendor(e.target.value)} placeholder="Anthropic" />
            </div>
            <div className="adm-field">
              <span className="adm-label">Release (YYYY-MM)</span>
              <input className="adm-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="2025-09" />
            </div>
            <div className="adm-field">
              <span className="adm-label">Color</span>
              <div className="adm-row">
                <input type="color" className="adm-color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                <input className="adm-input" value={newColor} onChange={(e) => setNewColor(e.target.value)} style={{ fontFamily: "var(--mono)", width: 110 }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="primary-btn" onClick={submitNewAgent} disabled={pending}>
              {pending ? "Creating…" : `Create + add to ${mode === "detect" ? "Detect" : "Exploit"}`}
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
