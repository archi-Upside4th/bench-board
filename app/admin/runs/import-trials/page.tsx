import { ImportTrialsForm } from "./ImportTrialsForm";

export const dynamic = "force-dynamic";

export default function ImportTrialsPage() {
  return (
    <div className="wrap adm-wrap" style={{ maxWidth: 1100 }}>
      <h1 className="adm-h1">Import per-trial results</h1>
      <p className="lede" style={{ marginTop: 8, maxWidth: "70ch" }}>
        Paste raw trial output (one task × one agent × one trial per record).
        Records are grouped by <code>run_id</code>, <code>mode</code>, and the
        chosen agent key, then aggregated into precision/recall/F1 (detect) or
        success/partial/fail rates (exploit) per agent.
      </p>
      <ImportTrialsForm />
    </div>
  );
}
