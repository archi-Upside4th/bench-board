"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importTrialResults,
  clearAccumulatedTrials,
  type TrialImportSummary,
} from "@/lib/actions";

const EXAMPLE = `{"ts": "2026-05-19T10:57:24+00:00", "run_id": "778f7a1023db", "task": "synth-nft-lending-002", "agent": "openrouter-detect", "model": "openai/gpt-oss-120b:free", "mode": "detect", "label": "fail", "score": 0.0, "cost_usd": null, "tp_findings": 0, "fp_findings_estimate": 5, "fn_findings": 1}
{"ts": "2026-05-19T10:58:11+00:00", "run_id": "778f7a1023db", "task": "synth-flash-loan-001", "agent": "openrouter-detect", "model": "openai/gpt-oss-120b:free", "mode": "detect", "label": "ok", "score": 0.5, "cost_usd": 0.012, "tp_findings": 2, "fp_findings_estimate": 1, "fn_findings": 0}`;

type ExistingRun = { id: number; runId: string; version: string; isPublic: boolean };

export function ImportTrialsForm({ existingRuns = [] }: { existingRuns?: ExistingRun[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [resetting, startReset] = useTransition();
  const [raw, setRaw] = useState("");
  const [keyField, setKeyField] = useState<"model" | "agent">("model");
  // "" = use most-recent existing run; otherwise the id of a specific run
  const [targetRunId, setTargetRunId] = useState<string>("");
  const [summary, setSummary] = useState<TrialImportSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  function submit() {
    setErr(null);
    setSummary(null);
    const text = raw.trim();
    if (!text) { setErr("Paste at least one trial record."); return; }
    const trid = targetRunId ? Number(targetRunId) : undefined;
    start(async () => {
      try {
        const s = await importTrialResults(text, {
          agentKeyField: keyField,
          targetRunId: trid,
        });
        setSummary(s);
        setRaw("");
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  function resetAll() {
    if (!confirm(
      "Wipe ALL accumulated trial records?\n\n" +
      "Also clears the target run's detect_results / exploit_results so the leaderboard shows nothing for it. Irreversible."
    )) return;
    const trid = targetRunId ? Number(targetRunId) : undefined;
    setResetMsg(null);
    startReset(async () => {
      try {
        await clearAccumulatedTrials({ targetRunId: trid });
        setResetMsg("Accumulated trials wiped. Next paste starts fresh.");
        router.refresh();
        setTimeout(() => setResetMsg(null), 4000);
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  function loadExample() {
    setRaw(EXAMPLE);
  }

  return (
    <div>
      <div className="adm-banner" style={{ marginTop: 16 }}>
        <strong>How accumulation works:</strong> every paste <b>appends</b> each
        trial to a permanent <code>raw_trials</code> table. After the insert, the
        target run's detect/exploit rows are <b>recomputed from the full history</b>
        for each touched (agent, mode). So:
        <ul style={{ marginTop: 8, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Pasting more trials for the same model = more data feeding into the same F1.</li>
          <li>The JSON's <code>run_id</code> is ignored for grouping (kept only as provenance).</li>
          <li>To start over, hit <b>Reset accumulator</b> below.</li>
        </ul>
      </div>

      <section className="adm-section">
        <h2 className="adm-h2">Settings</h2>
        <div className="adm-grid cols-2" style={{ marginTop: 16 }}>
          <div className="adm-field" style={{ gridColumn: "1 / -1" }}>
            <span className="adm-label">Output run</span>
            <select
              className="adm-select"
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
            >
              <option value="">Most recent run (default)</option>
              {existingRuns.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.version} {r.isPublic ? "· public" : "· hidden"} · {r.runId}
                </option>
              ))}
            </select>
            <span className="adm-hint">
              The run whose Detect / Exploit tables are overwritten with the recomputed aggregates.
            </span>
          </div>
          <div className="adm-field">
            <span className="adm-label">Agent identifier source</span>
            <select
              className="adm-select"
              value={keyField}
              onChange={(e) => setKeyField(e.target.value as "model" | "agent")}
            >
              <option value="model">model (e.g. openai/gpt-oss-120b:free)</option>
              <option value="agent">agent (e.g. openrouter-detect)</option>
            </select>
            <span className="adm-hint">
              Used as the agent.id key. Missing agents are auto-created with an inferred vendor and color.
            </span>
          </div>
        </div>
      </section>

      <section className="adm-section">
        <div className="adm-row between">
          <h2 className="adm-h2">Paste trial records</h2>
          <button type="button" className="ghost-btn" onClick={loadExample}>Load example</button>
        </div>
        <p className="lede" style={{ marginTop: 8 }}>
          Accepts: a JSON array, NDJSON (one trial per line), or a single object.
          Required fields per record: <code>mode</code> (detect / exploit) and
          either <code>model</code> or <code>agent</code>.
        </p>
        <textarea
          className="adm-textarea"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={16}
          style={{ marginTop: 12, lineHeight: 1.55, minHeight: 320 }}
          placeholder={'{"mode": "detect", "agent": "...", "model": "...", "tp_findings": 1, ...}'}
        />
      </section>

      <section className="adm-section" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="primary-btn" type="button" onClick={submit} disabled={pending}>
          {pending ? "Aggregating…" : "Append & recompute"}
        </button>
        <button
          className="ghost-btn"
          type="button"
          onClick={resetAll}
          disabled={resetting}
          style={{ color: "var(--bad)" }}
        >
          {resetting ? "Resetting…" : "Reset accumulator"}
        </button>
        <span className="lede">
          Trials are appended; the chosen run's aggregates are recomputed from the full history.
        </span>
      </section>

      {err ? <div className="adm-banner err" style={{ marginTop: 16 }}>{err}</div> : null}
      {resetMsg ? <div className="adm-banner ok" style={{ marginTop: 16 }}>{resetMsg}</div> : null}

      {summary ? (
        <section className="adm-section">
          <h2 className="adm-h2">Import summary</h2>
          <div className="adm-grid cols-3" style={{ marginTop: 16 }}>
            <Stat label="Trials parsed" value={summary.trialsParsed} />
            <Stat label="Trials skipped" value={summary.trialsSkipped} />
            <Stat label="Agents auto-created" value={summary.agentsCreated.length} />
          </div>

          {summary.runs.length > 0 ? (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Run updated
              </h3>
              <table className="adm-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Version</th>
                    <th className="num">Detect agents recomputed</th>
                    <th className="num">Exploit agents recomputed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.runs.map((r) => (
                    <tr key={r.runId}>
                      <td className="mono" style={{ fontSize: 12 }}>{r.runId}</td>
                      <td>{r.version}</td>
                      <td className="num">{r.detectAgents}</td>
                      <td className="num">{r.exploitAgents}</td>
                      <td>
                        <a className="ghost-btn" href={`/admin`} style={{ height: 26, padding: "0 10px", fontSize: 12 }}>
                          Open in dashboard
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {summary.agentsCreated.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <h3 style={{ fontSize: 13, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Auto-created agents
              </h3>
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 13, color: "var(--ink-2)" }}>
                {summary.agentsCreated.map((a) => (
                  <li key={a} className="mono" style={{ fontSize: 12.5 }}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.warnings.length > 0 ? (
            <div className="adm-banner" style={{ marginTop: 18 }}>
              <strong>Warnings ({summary.warnings.length}):</strong>
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {summary.warnings.slice(0, 10).map((w, i) => (
                  <li key={i} style={{ fontSize: 12 }}>{w}</li>
                ))}
                {summary.warnings.length > 10 ? <li style={{ fontSize: 12, color: "var(--mute)" }}>… and {summary.warnings.length - 10} more</li> : null}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg-card)" }}>
      <div style={{ fontSize: 11, color: "var(--mute)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: "var(--mono)", color: "var(--ink)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
