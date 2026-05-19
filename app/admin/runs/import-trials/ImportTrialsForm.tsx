"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importTrialResults, type TrialImportSummary } from "@/lib/actions";

const EXAMPLE = `{"ts": "2026-05-19T10:57:24+00:00", "run_id": "778f7a1023db", "task": "synth-nft-lending-002", "agent": "openrouter-detect", "model": "openai/gpt-oss-120b:free", "mode": "detect", "label": "fail", "score": 0.0, "cost_usd": null, "tp_findings": 0, "fp_findings_estimate": 5, "fn_findings": 1}
{"ts": "2026-05-19T10:58:11+00:00", "run_id": "778f7a1023db", "task": "synth-flash-loan-001", "agent": "openrouter-detect", "model": "openai/gpt-oss-120b:free", "mode": "detect", "label": "ok", "score": 0.5, "cost_usd": 0.012, "tp_findings": 2, "fp_findings_estimate": 1, "fn_findings": 0}`;

type ExistingRun = { id: number; runId: string; version: string; isPublic: boolean };

export function ImportTrialsForm({ existingRuns = [] }: { existingRuns?: ExistingRun[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [raw, setRaw] = useState("");
  const [keyField, setKeyField] = useState<"model" | "agent">("model");
  const [version, setVersion] = useState("");
  // "" = use run_id from JSON; otherwise the id of an existing run
  const [targetRunId, setTargetRunId] = useState<string>("");
  const [summary, setSummary] = useState<TrialImportSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
          defaultVersion: version || undefined,
          targetRunId: trid,
        });
        setSummary(s);
        router.refresh();
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
      <section className="adm-section">
        <h2 className="adm-h2">Settings</h2>
        <div className="adm-grid cols-2" style={{ marginTop: 16 }}>
          <div className="adm-field" style={{ gridColumn: "1 / -1" }}>
            <span className="adm-label">Target run</span>
            <select
              className="adm-select"
              value={targetRunId}
              onChange={(e) => setTargetRunId(e.target.value)}
            >
              <option value="">Use run_id from each record (create new if missing)</option>
              {existingRuns.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.version} {r.isPublic ? "· public" : "· hidden"} · {r.runId}
                </option>
              ))}
            </select>
            <span className="adm-hint">
              Pick an existing run to <b>merge into</b> it — every record's <code>run_id</code> is
              rewritten to that run before grouping. Keeps you from accidentally spawning duplicate runs.
              Note: per-(run, agent, mode) results are <i>replaced</i> by the latest paste, not accumulated.
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
          <div className="adm-field">
            <span className="adm-label">Default version (only when creating new run)</span>
            <input
              className="adm-input"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="v0.5 (optional)"
              disabled={!!targetRunId}
            />
            <span className="adm-hint">
              {targetRunId
                ? "Ignored — you're merging into an existing run."
                : "If the run_id doesn't exist yet, a new private run is created with this version."}
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
          Required fields per record: <code>run_id</code>, <code>mode</code> (detect/exploit),
          and either <code>model</code> or <code>agent</code>.
        </p>
        <textarea
          className="adm-textarea"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={16}
          style={{ marginTop: 12, lineHeight: 1.55, minHeight: 320 }}
          placeholder={'{"run_id": "abc", "mode": "detect", "agent": "...", "model": "...", "tp_findings": 1, ...}'}
        />
      </section>

      <section className="adm-section" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="primary-btn" type="button" onClick={submit} disabled={pending}>
          {pending ? "Aggregating…" : "Aggregate & import"}
        </button>
        <span className="lede">Per-(run, mode, agent) buckets are computed then upserted.</span>
      </section>

      {err ? <div className="adm-banner err" style={{ marginTop: 16 }}>{err}</div> : null}

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
                Runs touched
              </h3>
              <table className="adm-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Version</th>
                    <th className="num">Detect agents</th>
                    <th className="num">Exploit agents</th>
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
