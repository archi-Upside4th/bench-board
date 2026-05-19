import { db } from "@/db";
import { agents } from "@/db/schema";
import { upsertAgent, deleteAgent } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AgentsAdmin() {
  const rows = await db.select().from(agents);

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 880 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Agents</h1>
      <p className="lede" style={{ marginTop: 12 }}>
        Each evaluated model is one agent row. The <code>id</code> is the foreign key
        used by all result tables, so don't rename it after results are imported.
      </p>

      <section style={{ marginTop: 40 }}>
        <h3>Add / update agent</h3>
        <form action={upsertAgent} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          <Field name="id" label="Agent ID" placeholder="claude-opus-4-7" required />
          <Field name="vendor" label="Vendor" placeholder="Anthropic" required />
          <Field name="release_date" label="Release (YYYY-MM)" placeholder="2026-03" required />
          <Field name="color" label="Color (hex)" placeholder="#D97757" required />
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="primary-btn" type="submit">Save</button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 56 }}>
        <h3>Current agents ({rows.length})</h3>
        <table className="lb" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Vendor</th>
              <th>Release</th>
              <th>Color</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="agent-cell">
                  <span className="agent-swatch" style={{ background: a.color }} />
                  <span className="agent-name">{a.id}</span>
                </td>
                <td className="vendor">{a.vendor}</td>
                <td className="num-col">{a.releaseDate}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a.color}</td>
                <td>
                  <form action={deleteAgent}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="ghost-btn" type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute)" }}>
        {label}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          color: "var(--ink)",
          borderRadius: 6,
          padding: "10px 12px",
          fontFamily: "var(--mono)",
          fontSize: 13,
        }}
      />
    </label>
  );
}
