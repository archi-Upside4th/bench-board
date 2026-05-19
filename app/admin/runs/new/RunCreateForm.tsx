"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRun, importRunFromJson, type CreateRunInput } from "@/lib/actions";
import type { Agent } from "@/db/schema";

type DetectRow = {
  precision: string;
  recall: string;
  f1: string;
  f1_ci_low: string;
  f1_ci_high: string;
  cost_usd_per_task: string;
  n_tasks: string;
};
type ExploitRow = {
  success: string;
  partial: string;
  fail: string;
  cost_usd_per_task: string;
  n_tasks: string;
};

const emptyDetect = (): DetectRow => ({
  precision: "",
  recall: "",
  f1: "",
  f1_ci_low: "",
  f1_ci_high: "",
  cost_usd_per_task: "",
  n_tasks: "",
});
const emptyExploit = (): ExploitRow => ({
  success: "",
  partial: "",
  fail: "",
  cost_usd_per_task: "",
  n_tasks: "",
});

const SUGGESTED_FP_CATEGORIES = [
  "Trusted Callee Reentrancy",
  "Permissionless by Design",
  "0.8+ Overflow",
  "Trusted ERC20",
  "Timestamp Long Window",
  "Bounded Unchecked",
  "Canonical Address",
  "Chainlink Aggregator",
  "Internal-Only Slippage",
  "Bounded Loop",
  "EIP-712 Replay Protection",
];

export function RunCreateForm({ allAgents }: { allAgents: Agent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"form" | "json">("form");

  // Meta
  const [version, setVersion] = useState("v0.4");
  const [runId, setRunId] = useState(`bench-board-eval-${new Date().toISOString().slice(0, 7)}`);
  const [judgeModel, setJudgeModel] = useState("gpt-5 · claude-sonnet-4.6 · gemini-3.1-pro · majority-of-3");
  const [trialsPerTask, setTrialsPerTask] = useState("3");
  const [totalTasks, setTotalTasks] = useState("120");
  const [positiveTasks, setPositiveTasks] = useState("95");
  const [negativeTasks, setNegativeTasks] = useState("25");
  const [categoriesCount, setCategoriesCount] = useState("7");
  const [isPublic, setIsPublic] = useState(true);

  // Agents picker
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Per-agent rows
  const [detect, setDetect] = useState<Record<string, DetectRow>>({});
  const [exploit, setExploit] = useState<Record<string, ExploitRow>>({});

  // FP categories
  const [fpCategories, setFpCategories] = useState<string[]>([...SUGGESTED_FP_CATEGORIES]);
  const [fpRates, setFpRates] = useState<Record<string, Record<string, string>>>({});
  const [newCategory, setNewCategory] = useState("");

  // JSON fallback
  const [jsonPayload, setJsonPayload] = useState("");

  const selectedAgents = useMemo(
    () => allAgents.filter((a) => selected.has(a.id)),
    [allAgents, selected]
  );

  function toggleAgent(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (!detect[id]) setDetect((d) => ({ ...d, [id]: emptyDetect() }));
      if (!exploit[id]) setExploit((d) => ({ ...d, [id]: emptyExploit() }));
    }
    setSelected(next);
  }

  function selectAll() {
    const all = new Set(allAgents.map((a) => a.id));
    setSelected(all);
    const dInit: Record<string, DetectRow> = { ...detect };
    const eInit: Record<string, ExploitRow> = { ...exploit };
    for (const a of allAgents) {
      if (!dInit[a.id]) dInit[a.id] = emptyDetect();
      if (!eInit[a.id]) eInit[a.id] = emptyExploit();
    }
    setDetect(dInit);
    setExploit(eInit);
  }
  function selectNone() {
    setSelected(new Set());
  }

  function updateDetect(id: string, field: keyof DetectRow, val: string) {
    setDetect((d) => ({ ...d, [id]: { ...(d[id] ?? emptyDetect()), [field]: val } }));
  }
  function updateExploit(id: string, field: keyof ExploitRow, val: string) {
    setExploit((d) => ({ ...d, [id]: { ...(d[id] ?? emptyExploit()), [field]: val } }));
  }
  function updateFp(agent: string, cat: string, val: string) {
    setFpRates((r) => ({ ...r, [agent]: { ...(r[agent] ?? {}), [cat]: val } }));
  }
  function addFpCategory() {
    const name = newCategory.trim();
    if (!name || fpCategories.includes(name)) return;
    setFpCategories((c) => [...c, name]);
    setNewCategory("");
  }
  function removeFpCategory(cat: string) {
    setFpCategories((c) => c.filter((x) => x !== cat));
    setFpRates((r) => {
      const next: typeof r = {};
      for (const [a, row] of Object.entries(r)) {
        const { [cat]: _drop, ...rest } = row;
        next[a] = rest;
      }
      return next;
    });
  }

  function n(s: string): number {
    const v = Number(s);
    return Number.isFinite(v) ? v : 0;
  }
  function isFilled(s: string) {
    return s.trim().length > 0 && !Number.isNaN(Number(s));
  }

  function buildPayload(): CreateRunInput {
    const detectRows = selectedAgents
      .filter((a) => {
        const r = detect[a.id];
        return r && ["precision", "recall", "f1", "n_tasks"].every((k) => isFilled(r[k as keyof DetectRow]));
      })
      .map((a) => {
        const r = detect[a.id];
        return {
          agent: a.id,
          precision: n(r.precision),
          recall: n(r.recall),
          f1: n(r.f1),
          f1_ci_low: isFilled(r.f1_ci_low) ? n(r.f1_ci_low) : n(r.f1),
          f1_ci_high: isFilled(r.f1_ci_high) ? n(r.f1_ci_high) : n(r.f1),
          cost_usd_per_task: n(r.cost_usd_per_task),
          n_tasks: Math.round(n(r.n_tasks)),
        };
      });

    const exploitRows = selectedAgents
      .filter((a) => {
        const r = exploit[a.id];
        return r && ["success", "partial", "fail", "n_tasks"].every((k) => isFilled(r[k as keyof ExploitRow]));
      })
      .map((a) => {
        const r = exploit[a.id];
        return {
          agent: a.id,
          success: n(r.success),
          partial: n(r.partial),
          fail: n(r.fail),
          cost_usd_per_task: n(r.cost_usd_per_task),
          n_tasks: Math.round(n(r.n_tasks)),
        };
      });

    const fpRowsBuilt = selectedAgents
      .map((a) => {
        const rates = fpCategories.map((cat) => {
          const v = fpRates[a.id]?.[cat];
          return isFilled(v ?? "") ? n(v!) : 0;
        });
        return { agent: a.id, rates };
      })
      .filter((row) => row.rates.some((v) => v > 0));

    return {
      meta: {
        dataset_version: version.trim(),
        evaluation_run_id: runId.trim(),
        judge_model: judgeModel.trim(),
        trials_per_task: Math.round(n(trialsPerTask)),
        total_tasks: Math.round(n(totalTasks)),
        positive_tasks: Math.round(n(positiveTasks)),
        negative_tasks: Math.round(n(negativeTasks)),
        categories: Math.round(n(categoriesCount)),
        is_public: isPublic,
      },
      detect: detectRows,
      exploit: exploitRows,
      fp: { categories: fpCategories, rows: fpRowsBuilt },
    };
  }

  function submitForm() {
    setError(null);
    const payload = buildPayload();
    if (payload.detect.length === 0) {
      setError("At least one agent must have all four required Detect fields filled (precision, recall, f1, n_tasks).");
      return;
    }
    start(async () => {
      try {
        const { id } = await createRun(payload);
        router.push(`/admin/runs/${id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function submitJson() {
    setError(null);
    const raw = jsonPayload.trim();
    if (!raw) {
      setError("JSON payload is empty.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError("Invalid JSON: " + (e as Error).message);
      return;
    }
    start(async () => {
      try {
        await importRunFromJson(parsed);
        router.push("/admin");
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1280 }}>
      <div className="adm-row between" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="adm-h1">New evaluation run</h1>
          <p className="lede" style={{ marginTop: 8 }}>
            Pick which agents participated, fill the per-agent numbers, hit Save.
          </p>
        </div>
        <div className="adm-tabs" role="tablist">
          <button type="button" aria-pressed={mode === "form"} onClick={() => setMode("form")}>Form</button>
          <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>Paste JSON</button>
        </div>
      </div>

      {error ? <div className="adm-banner err" style={{ marginTop: 16 }}>{error}</div> : null}

      {mode === "json" ? (
        <section className="adm-section">
          <h2 className="adm-h2">Paste full run JSON</h2>
          <p className="lede" style={{ marginTop: 8 }}>
            Same schema as before. Useful when you already have output from an evaluation pipeline.
          </p>
          <textarea
            className="adm-textarea"
            spellCheck={false}
            value={jsonPayload}
            onChange={(e) => setJsonPayload(e.target.value)}
            style={{ minHeight: 420, marginTop: 16, lineHeight: 1.55 }}
            placeholder='{"meta": {...}, "summary_detect_blocked": [...], ...}'
          />
          <div className="adm-row" style={{ marginTop: 16 }}>
            <button className="primary-btn" type="button" onClick={submitJson} disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="adm-section">
            <h2 className="adm-h2">Meta</h2>
            <div className="adm-grid cols-4" style={{ marginTop: 16 }}>
              <Field label="Dataset version" value={version} onChange={setVersion} placeholder="v0.4" />
              <Field label="Run ID (unique)" value={runId} onChange={setRunId} mono />
              <Field label="Trials per task" value={trialsPerTask} onChange={setTrialsPerTask} type="number" min={1} />
              <Field
                label="Public on /"
                custom={
                  <label className="adm-row" style={{ height: 36 }}>
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontSize: 12.5 }}>{isPublic ? "Will be shown" : "Hidden (admin only)"}</span>
                  </label>
                }
              />
              <Field label="Total tasks" value={totalTasks} onChange={setTotalTasks} type="number" />
              <Field label="Positive tasks" value={positiveTasks} onChange={setPositiveTasks} type="number" />
              <Field label="Negative tasks" value={negativeTasks} onChange={setNegativeTasks} type="number" />
              <Field label="Categories" value={categoriesCount} onChange={setCategoriesCount} type="number" />
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Judge model" value={judgeModel} onChange={setJudgeModel} placeholder="gpt-5 · …" mono />
              </div>
            </div>
          </section>

          <section className="adm-section">
            <div className="adm-row between">
              <div>
                <h2 className="adm-h2">Agents in this run</h2>
                <p className="lede" style={{ marginTop: 6 }}>
                  Tick each model that ran. Empty rows will be skipped on save.
                </p>
              </div>
              <div className="adm-row">
                <button type="button" className="ghost-btn" onClick={selectAll}>Select all</button>
                <button type="button" className="ghost-btn" onClick={selectNone}>Clear</button>
              </div>
            </div>
            <div className="adm-agent-picker" style={{ marginTop: 16 }}>
              {allAgents.length === 0 ? (
                <p className="lede">No agents yet — add some on <a href="/admin/agents">/admin/agents</a> first.</p>
              ) : (
                allAgents.map((a) => (
                  <label key={a.id} className={`adm-agent-pick ${selected.has(a.id) ? "on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleAgent(a.id)}
                    />
                    <span className="agent-swatch" style={{ background: a.color }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span className="agent-name">{a.id}</span>
                      <div className="vendor" style={{ fontSize: 11, marginTop: 2 }}>{a.vendor}</div>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>

          {selectedAgents.length > 0 ? (
            <>
              <section className="adm-section">
                <h2 className="adm-h2">Detect mode — per-agent</h2>
                <p className="lede" style={{ marginTop: 6 }}>
                  Required: <code>precision</code>, <code>recall</code>, <code>f1</code>, <code>n_tasks</code>.
                  CI bounds default to f1 if blank.
                </p>
                <div style={{ overflowX: "auto", marginTop: 16 }}>
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Agent</th>
                        <th className="num">Precision</th>
                        <th className="num">Recall</th>
                        <th className="num">F1</th>
                        <th className="num">F1 CI low</th>
                        <th className="num">F1 CI high</th>
                        <th className="num">$ / task</th>
                        <th className="num">N tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgents.map((a) => {
                        const row = detect[a.id] ?? emptyDetect();
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className="agent-cell">
                                <span className="agent-swatch" style={{ background: a.color }} />
                                <span className="agent-name">{a.id}</span>
                              </div>
                            </td>
                            {(["precision", "recall", "f1", "f1_ci_low", "f1_ci_high", "cost_usd_per_task", "n_tasks"] as (keyof DetectRow)[]).map((k) => (
                              <td className="tight" key={k}>
                                <input
                                  className="adm-input num"
                                  inputMode="decimal"
                                  value={row[k]}
                                  onChange={(e) => updateDetect(a.id, k, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="adm-section">
                <h2 className="adm-h2">Exploit mode — per-agent</h2>
                <p className="lede" style={{ marginTop: 6 }}>
                  Optional section. Leave blank to skip. Success / Partial / Fail should sum to 1.0.
                </p>
                <div style={{ overflowX: "auto", marginTop: 16 }}>
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Agent</th>
                        <th className="num">Success</th>
                        <th className="num">Partial</th>
                        <th className="num">Fail</th>
                        <th className="num">$ / task</th>
                        <th className="num">N tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgents.map((a) => {
                        const row = exploit[a.id] ?? emptyExploit();
                        const sum =
                          n(row.success) + n(row.partial) + n(row.fail);
                        const sumOff = sum > 0 && Math.abs(sum - 1) > 0.01;
                        return (
                          <tr key={a.id}>
                            <td>
                              <div className="agent-cell">
                                <span className="agent-swatch" style={{ background: a.color }} />
                                <span className="agent-name">{a.id}</span>
                              </div>
                            </td>
                            {(["success", "partial", "fail", "cost_usd_per_task", "n_tasks"] as (keyof ExploitRow)[]).map((k) => (
                              <td className="tight" key={k}>
                                <input
                                  className={`adm-input num ${sumOff && ["success", "partial", "fail"].includes(k) ? "invalid" : ""}`}
                                  inputMode="decimal"
                                  value={row[k]}
                                  onChange={(e) => updateExploit(a.id, k, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="adm-section">
                <div className="adm-row between">
                  <div>
                    <h2 className="adm-h2">False-positive rates</h2>
                    <p className="lede" style={{ marginTop: 6 }}>
                      Optional. One number per (agent × category), values 0–1. Lower is better.
                    </p>
                  </div>
                  <div className="adm-row">
                    <input
                      className="adm-input"
                      placeholder="Add category…"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addFpCategory();
                        }
                      }}
                      style={{ width: 240 }}
                    />
                    <button type="button" className="ghost-btn" onClick={addFpCategory}>+ Add</button>
                  </div>
                </div>
                <div style={{ overflowX: "auto", marginTop: 16 }}>
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Agent</th>
                        {fpCategories.map((c) => (
                          <th key={c}>
                            <div className="adm-row" style={{ gap: 6, justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10.5, textTransform: "none", letterSpacing: 0, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>
                                {c}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFpCategory(c)}
                                title={`Remove ${c}`}
                                style={{ background: "transparent", border: 0, color: "var(--mute-2)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
                              >
                                ×
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgents.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div className="agent-cell">
                              <span className="agent-swatch" style={{ background: a.color }} />
                              <span className="agent-name">{a.id}</span>
                            </div>
                          </td>
                          {fpCategories.map((c) => (
                            <td className="tight" key={c}>
                              <input
                                className="adm-input num"
                                inputMode="decimal"
                                value={fpRates[a.id]?.[c] ?? ""}
                                onChange={(e) => updateFp(a.id, c, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          <section className="adm-section" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="primary-btn" type="button" onClick={submitForm} disabled={pending || selectedAgents.length === 0}>
              {pending ? "Saving…" : "Save run"}
            </button>
            <span className="lede">
              Same <code>Run ID</code> as an existing run will replace its result rows.
            </span>
          </section>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  mono,
  custom,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  mono?: boolean;
  custom?: React.ReactNode;
}) {
  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>
      {custom ? (
        custom
      ) : (
        <input
          className="adm-input"
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          min={min}
          style={mono ? { fontFamily: "var(--mono)" } : undefined}
        />
      )}
    </div>
  );
}
