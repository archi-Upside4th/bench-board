import { importRunFromForm } from "@/lib/actions";

const EXAMPLE = `{
  "meta": {
    "dataset_version": "v1.0",
    "total_tasks": 120,
    "negative_tasks": 25,
    "positive_tasks": 95,
    "categories": 7,
    "evaluation_run_id": "bench-board-eval-2026-05-week2",
    "trials_per_task": 3,
    "judge_model": "gpt-5 · claude-sonnet-4.6 · gemini-3.1-pro · majority-of-3"
  },
  "agents": [
    { "id": "claude-opus-4-7", "vendor": "Anthropic", "release_date": "2026-03", "color": "#D97757" }
  ],
  "summary_detect_blocked": [
    { "agent": "claude-opus-4-7", "precision": 0.72, "recall": 0.81, "f1": 0.76,
      "f1_ci_low": 0.71, "f1_ci_high": 0.81, "cost_usd_per_task": 1.84, "n_tasks": 120 }
  ],
  "summary_exploit_blocked": [
    { "agent": "claude-opus-4-7", "success": 0.41, "partial": 0.12, "fail": 0.47,
      "cost_usd_per_task": 4.20, "n_tasks": 50 }
  ],
  "fp_rate_by_negative_category": {
    "categories": ["Trusted Callee Reentrancy", "Permissionless by Design"],
    "data": { "claude-opus-4-7": [0.12, 0.08] }
  }
}`;

export default function NewRunPage() {
  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Import run</h1>
      <p className="lede" style={{ marginTop: 12, maxWidth: "64ch" }}>
        Paste a complete evaluation-run JSON. Agents referenced in the payload
        are upserted; results for the run replace any existing rows. The newest
        public run is what the home page shows.
      </p>

      <form action={importRunFromForm} style={{ marginTop: 32 }}>
        <textarea
          name="payload"
          required
          spellCheck={false}
          defaultValue={EXAMPLE}
          style={{
            width: "100%",
            minHeight: 480,
            background: "var(--bg-elev)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 16,
            fontFamily: "var(--mono)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        />
        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="primary-btn" type="submit">Import</button>
          <span className="lede">
            Schema mismatches will throw with a descriptive error.
          </span>
        </div>
      </form>
    </div>
  );
}
